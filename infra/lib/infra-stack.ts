import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- VPC (1 NAT gateway to save cost) ---
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
    });

    // --- Security groups ---
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "Allow HTTP from internet",
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP");

    const appSg = new ec2.SecurityGroup(this, "AppSg", {
      vpc,
      description: "Allow traffic from ALB only",
      allowAllOutbound: true,
    });
    appSg.addIngressRule(albSg, ec2.Port.tcp(3000), "Allow 3000 from ALB");

    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: "Allow PostgreSQL from app only",
      allowAllOutbound: true,
    });
    dbSg.addIngressRule(appSg, ec2.Port.tcp(5432), "Allow 5432 from app");

    // --- RDS PostgreSQL (private subnets, minimal instance) ---
    const db = new rds.DatabaseInstance(this, "Db", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      databaseName: "snippet_manager",
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- ECR repository for the API image ---
    const repo = new ecr.Repository(this, "ApiRepo", {
      repositoryName: "snippet-manager-api",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // --- ECS cluster + Fargate ---
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
    });

    const executionRole = new iam.Role(this, "TaskExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
    });
    if (!db.secret) {
      throw new Error("RDS secret not available");
    }
    db.secret.grantRead(executionRole);

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const container = taskDef.addContainer("api", {
      image: ecs.ContainerImage.fromEcrRepository(repo, "latest"),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(db.secret, "host"),
        DB_PORT: ecs.Secret.fromSecretsManager(db.secret, "port"),
        DB_USERNAME: ecs.Secret.fromSecretsManager(db.secret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(db.secret, "password"),
        DB_NAME: ecs.Secret.fromSecretsManager(db.secret, "dbname"),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "api",
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [appSg],
    });

    // --- ALB ---
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    const tg = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyHttpCodes: "200",
      },
    });

    service.attachToApplicationTargetGroup(tg);

    alb.addListener("Listener", {
      port: 80,
      defaultTargetGroups: [tg],
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "ApiRepoUri", {
      value: repo.repositoryUri,
      description:
        "ECR repository URI - push your Docker image here (tag: latest)",
    });
    new cdk.CfnOutput(this, "AlbDnsName", {
      value: alb.loadBalancerDnsName,
      description: "ALB DNS name - open in browser to hit the API",
    });
    new cdk.CfnOutput(this, "DbSecretArn", {
      value: db.secret.secretArn,
      description: "RDS master secret ARN (Secrets Manager)",
    });
    new cdk.CfnOutput(this, "EcsClusterName", {
      value: cluster.clusterName,
      description: "ECS cluster name - for CI/CD (force new deployment)",
    });
    new cdk.CfnOutput(this, "EcsServiceName", {
      value: service.serviceName,
      description: "ECS service name - for CI/CD (force new deployment)",
    });
  }
}
