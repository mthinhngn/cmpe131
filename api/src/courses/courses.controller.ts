import { Controller, Get, Param, Query } from "@nestjs/common";
import { CoursesService } from "./courses.service";

@Controller("courses")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get(":id")
  course(@Param("id") id: string, @Query("catalogYear") catalogYear?: string) {
    return this.courses.course(id, catalogYear);
  }
}
