type UUID = string
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid'
import { validate, version } from 'uuid'
function genUUIDv5(name: string): UUID {
  return uuidv5(name, uuidv5.DNS) as UUID
}
function genUUIDv4(): UUID {
  return uuidv4() as UUID
}
function genUUID(name?: string): UUID {
  return name ? genUUIDv5(name) : genUUIDv4()
}
function asUUID(id: string): UUID | undefined {
  return validate(id) ? (id as UUID) : undefined
}
function validateUUID(id: string): boolean {
  return validate(id)
}
export type { UUID, genUUID, asUUID, validateUUID }
