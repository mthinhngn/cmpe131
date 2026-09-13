import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ZodError } from "zod";
import { GeminiAgentService } from "./gemini-agent.service";

@Controller("agent")
export class AgentController {
  constructor(private readonly agent: GeminiAgentService) {}

  @Post("messages")
  async message(@Body() input: unknown) {
    try {
      return await this.agent.respond(this.agent.parseRequest(input));
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          code: "INVALID_AGENT_REQUEST",
          message: "The scheduling request is invalid.",
          issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        });
      }
      throw error;
    }
  }
}
