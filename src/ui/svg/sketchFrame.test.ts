import { describe, expect, it } from 'vitest'
import { applySketchTransform, sketchTransform } from './sketchFrame'

const base = { w: 2, h: 4 }

describe('sketch frame', () => {
  it('leaves an unrotated catalogue-size room in place', () => {
    expect(applySketchTransform(3, 5, 0, base, base, [0, 0])).toEqual([3, 5])
    expect(applySketchTransform(3, 5, 0, base, base, [2, 4])).toEqual([5, 9])
  })

  it('turns the sketch with the room', () => {
    expect(applySketchTransform(0, 0, 1, base, base, [0, 0])).toEqual([4, 0])
    expect(applySketchTransform(0, 0, 2, base, base, [0, 0])).toEqual([2, 4])
    expect(applySketchTransform(0, 0, 3, base, base, [0, 0])).toEqual([0, 2])
  })

  it('centres the sketch in a resized room, rotated too', () => {
    const size = { w: 4, h: 6 }
    expect(applySketchTransform(0, 0, 0, size, base, [0, 0])).toEqual([1, 1])
    expect(applySketchTransform(0, 0, 1, size, base, [0, 0])).toEqual([5, 1])
  })

  it('emits the transform the maths describes', () => {
    expect(sketchTransform(0, 0, 1, base, base)).toBe('translate(4 0) rotate(90) translate(0 0)')
  })
})
