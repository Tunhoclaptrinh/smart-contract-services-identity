import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  Inject,
} from "@nestjs/common";
import type { Response } from "express";
import { BaseService } from "../services/base.service";
import type { SessionRequest } from "../types";
import { attachmentHeader } from "../utils/csv";
import {
  BulkDeleteDto,
  ExportQueryDto,
  ImportBodyDto,
  ListQueryDto,
  TemplateQueryDto,
} from "../dto/resource.dto";
@Controller("resources")
export class BaseController {
  constructor(@Inject(BaseService) private service: BaseService) {}
  @Get() definitions() {
    return this.service.definitions;
  }
  /** Declared before `:resource/:id` so these names are never read as record ids. */
  @Get(":resource/export") async export(
    @Param("resource") name: string,
    @Query() query: ExportQueryDto,
    @Req() req: SessionRequest,
    @Res() res: Response,
  ) {
    const file = await this.service.export(name, query, req.user);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", attachmentHeader(file.fileName));
    res.send(file.body);
  }
  @Get(":resource/columns") columns(
    @Param("resource") name: string,
    @Req() req: SessionRequest,
  ) {
    return this.service.columns(name, req.user);
  }
  @Get(":resource/template") async template(
    @Param("resource") name: string,
    @Query() query: TemplateQueryDto,
    @Req() req: SessionRequest,
    @Res() res: Response,
  ) {
    const csv = await this.service.template(name, req.user, query.header);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      attachmentHeader(`${name}_template.csv`),
    );
    res.send(csv);
  }
  @Get(":resource") list(
    @Param("resource") name: string,
    @Query() query: ListQueryDto,
    @Req() req: SessionRequest,
  ) {
    return this.service.list(name, query, req.user);
  }
  @Get(":resource/:id") get(
    @Param("resource") name: string,
    @Param("id") id: string,
    @Req() req: SessionRequest,
  ) {
    return this.service.get(name, id, req.user);
  }
  @Post(":resource") create(
    @Param("resource") name: string,
    @Body() body: unknown,
    @Req() req: SessionRequest,
  ) {
    return this.service.create(name, body, req.user);
  }
  @Patch(":resource/:id") update(
    @Param("resource") name: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: SessionRequest,
  ) {
    return this.service.update(name, id, body, req.user);
  }
  @Delete(":resource/:id") remove(
    @Param("resource") name: string,
    @Param("id") id: string,
    @Req() req: SessionRequest,
  ) {
    return this.service.remove(name, id, req.user);
  }
  @Post(":resource/import/validate") validateImport(
    @Param("resource") name: string,
    @Body() body: ImportBodyDto,
    @Req() req: SessionRequest,
  ) {
    return this.service.validateImport(name, body, req.user);
  }
  @Post(":resource/import") import(
    @Param("resource") name: string,
    @Body() body: ImportBodyDto,
    @Req() req: SessionRequest,
  ) {
    return this.service.import(name, body, req.user);
  }
  @Post(":resource/bulk-delete") bulkDelete(
    @Param("resource") name: string,
    @Body() body: BulkDeleteDto,
    @Req() req: SessionRequest,
  ) {
    return this.service.bulkDelete(name, body, req.user);
  }
}
