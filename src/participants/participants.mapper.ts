import type { Participant } from "generated/prisma/client";
import type { ParticipantResponse } from "../receipts/receipts.types";

export function toParticipantResponse(
  participant: Participant,
): ParticipantResponse {
  return {
    id: participant.id,
    name: participant.name,
    createdAt: participant.createdAt,
  };
}
