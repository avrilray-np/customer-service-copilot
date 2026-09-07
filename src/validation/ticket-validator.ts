import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { Ticket } from "@/domain/ticket/types";
import schema from "./ticket-schema-v0.1.json";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile<Ticket>(schema);

export function isTicket(value: unknown): value is Ticket {
  return validate(value);
}

export function ticketValidationErrors() {
  return validate.errors;
}
