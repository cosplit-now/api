import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { ReceiptsService } from "./receipts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReceiptsService", () => {
  let service: ReceiptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<ReceiptsService>(ReceiptsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
