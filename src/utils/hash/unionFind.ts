/**
 * Union-Find (Disjoint Set) for efficient grouping
 */
export class UnionFind {
  private parent: Map<string, string> = new Map()
  private rank: Map<string, number> = new Map()

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.rank.set(x, 0)
    }
    const parentX = this.parent.get(x)
    if (parentX !== x) {
      if (parentX) {
        this.parent.set(x, this.find(parentX))
      }
    }
    return this.parent.get(x) || x
  }

  union(x: string, y: string): void {
    const rootX = this.find(x)
    const rootY = this.find(y)
    if (rootX === rootY) return

    const rankX = this.rank.get(rootX) || 0
    const rankY = this.rank.get(rootY) || 0

    if (rankX < rankY) {
      this.parent.set(rootX, rootY)
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX)
    } else {
      this.parent.set(rootY, rootX)
      this.rank.set(rootX, rankX + 1)
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const x of this.parent.keys()) {
      const root = this.find(x)
      if (!groups.has(root)) {
        groups.set(root, [])
      }
      const group = groups.get(root)
      if (group) {
        group.push(x)
      }
    }
    return groups
  }
}
