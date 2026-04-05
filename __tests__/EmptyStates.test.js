/**
 * Tests for warm empty states in AllPeopleView and AllCirclesView.
 * Verifies the source code contains the warm messaging patterns from DESIGN.md.
 */
import fs from 'fs'
import path from 'path'

const peopleSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'AllPeopleView.js'), 'utf8'
)
const circlesSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'AllCirclesView.js'), 'utf8'
)

describe('Warm Empty States', () => {
  describe('AllPeopleView', () => {
    test('has a warm heading instead of generic "No results"', () => {
      expect(peopleSource).toMatch(/No people found/)
    })

    test('has helpful guidance text', () => {
      expect(peopleSource).toMatch(/Try a different search or filter/)
    })

    test('has a CTA button to join a circle', () => {
      expect(peopleSource).toMatch(/Join a Circle/)
    })

    test('uses design tokens for styling', () => {
      expect(peopleSource).toMatch(/tokens\.white/)
      expect(peopleSource).toMatch(/tokens\.borderMedium/)
      expect(peopleSource).toMatch(/fonts\.serif/)
    })

    test('uses dashed border pattern from DESIGN.md', () => {
      expect(peopleSource).toMatch(/1px dashed/)
    })
  })

  describe('AllCirclesView', () => {
    test('has a warm heading instead of generic "No circles match"', () => {
      expect(circlesSource).toMatch(/No circles found/)
    })

    test('has helpful guidance text', () => {
      expect(circlesSource).toMatch(/Try a different search/)
    })

    test('has a CTA button to create a circle', () => {
      expect(circlesSource).toMatch(/Create a Circle/)
    })

    test('uses design tokens for styling', () => {
      expect(circlesSource).toMatch(/tokens\.white/)
      expect(circlesSource).toMatch(/tokens\.borderMedium/)
      expect(circlesSource).toMatch(/fonts\.serif/)
    })

    test('uses dashed border pattern from DESIGN.md', () => {
      expect(circlesSource).toMatch(/1px dashed/)
    })
  })
})
