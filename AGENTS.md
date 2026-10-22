
- Query/list defaults use EMPTY_ARRAY from src/lib/empty.ts, never `data = []`: inline literals change identity every render and caused update-depth crash loops (enforced by src/test/no-unstable-defaults.test.ts).
- Shared TabsContent wraps children in SectionBoundary so a crash in one tab does not take down the whole screen.
