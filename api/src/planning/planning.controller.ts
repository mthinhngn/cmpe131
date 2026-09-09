import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { PlanningService, type ValidatePlanInput } from "./planning.service";

@Controller("plans")
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Post("validate")
  validate(@Body() body: ValidatePlanInput) {
    if (!Array.isArray(body.courseIds) || !Array.isArray(body.completedCourseIds) || !Array.isArray(body.selectedSectionIds)) {
      throw new BadRequestException("courseIds, completedCourseIds and selectedSectionIds must be arrays");
    }
    return this.planning.validate(body);
  }
}
