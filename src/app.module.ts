import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./lib/auth";
import { PrismaModule } from "./prisma/prisma.module";
import { S3Module } from "./s3/s3.module";
import { BullModule } from "@nestjs/bullmq";
import { ReceiptsModule } from "./receipts/receipts.module";

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    PrismaModule,
    S3Module,
    BullModule.forRoot({ connection: { host: "redis", port: 6379 } }),
    ReceiptsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
