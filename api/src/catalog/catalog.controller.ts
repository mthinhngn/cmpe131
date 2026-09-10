import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

@Controller("programs")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  programs() { return this.catalog.programs(); }

  @Get(":slug/requirements")
  requirements(@Param("slug") slug: string, @Query("catalogYear") catalogYear?: string) {
    return this.catalog.requirements(slug, catalogYear);
  }
}
