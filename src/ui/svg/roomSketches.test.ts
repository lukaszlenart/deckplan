import { describe, expect, it } from 'vitest'
import { MODULES } from '../../domain/catalogue'
import { ROOM_SKETCHES } from './roomSketches'

describe('room sketches', () => {
  it('has a sketch for every room and nothing else', () => {
    const rooms = Object.values(MODULES)
      .filter((d) => d.kind === 'room')
      .map((d) => d.id)
      .sort()
    expect(Object.keys(ROOM_SKETCHES).sort()).toEqual(rooms)
  })
})
