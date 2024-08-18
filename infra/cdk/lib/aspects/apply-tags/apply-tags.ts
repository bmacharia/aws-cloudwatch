import { IAspect, ITaggable, TagManager } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

type Tags = Record<string, string> & {
  // required tags below
  Environment: 'dev' | 'prod';
  App: 'cw-ho-tf';
  Iac: 'cdk' | 'tf';
};

// This aspect is responsible for tagging resources
export class ApplyTags implements IAspect {
  #tags: Tags;

  constructor(tags: Tags) {
    this.#tags = tags;
  }

  visit(node: IConstruct) {
    if (TagManager.isTaggable(node)) {
      Object.entries(this.#tags).forEach(([key, value]) => {
        this.applyTag(node, key, value);
      });
    }
  }

  applyTag(resource: ITaggable, key: string, value: string) {
    resource.tags.setTag(key, value);
  }
}
