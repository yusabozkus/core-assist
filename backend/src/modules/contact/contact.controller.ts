import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: CreateContactMessageDto, @Req() request: Request) {
    return this.contact.create(
      body,
      request.ip || request.socket.remoteAddress || '',
    );
  }
}
