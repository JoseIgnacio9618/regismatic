declare module "json2csv" {
  export class Parser<T = unknown> {
    constructor(options?: { fields?: string[] });
    parse(data: T): string;
  }
}
