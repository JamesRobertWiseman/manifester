export class ProjectJobs {
  readonly #projects = new Map<string, Promise<unknown>>();
  readonly #features = new Map<string, Promise<string>>();

  has(project: string): boolean {
    return this.#projects.has(project);
  }

  run<T>(project: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#projects.get(project) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.track(project, current);
    return current;
  }

  track(project: string, job: Promise<unknown>): void {
    this.#projects.set(project, job);
    void job.finally(() => {
      if (this.#projects.get(project) === job) this.#projects.delete(project);
    }).catch(() => undefined);
  }

  async feature(project: string, featureId: string, task: () => Promise<string>): Promise<string> {
    const key = `${project}\0${featureId}`;
    const existing = this.#features.get(key);
    if (existing) return existing;
    const current = this.run(project, task);
    this.#features.set(key, current);
    try {
      return await current;
    } finally {
      this.#features.delete(key);
    }
  }
}
