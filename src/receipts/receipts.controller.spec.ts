import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReceiptsController", () => {
  let controller: ReceiptsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [
        ReceiptsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: getQueueToken("receipt"),
          useValue: { add: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<ReceiptsController>(ReceiptsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
