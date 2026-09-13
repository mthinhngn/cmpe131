import { Module } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentToolsService } from "./agent-tools.service";
import { GeminiAgentService } from "./gemini-agent.service";
import { GeminiGateway } from "./gemini.gateway";

@Module({ controllers: [AgentController], providers: [AgentToolsService, GeminiAgentService, GeminiGateway] })
export class AgentModule {}
