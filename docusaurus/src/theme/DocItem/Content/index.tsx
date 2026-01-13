import React from 'react';
import DocItemContent from '@theme-original/DocItem/Content';
import GiscusComments from '@site/src/components/GiscusComments';
import { useDoc } from '@docusaurus/theme-common/internal';

export default function DocItemContentWrapper(props) {
  const { frontMatter } = useDoc();
  
  return (
    <>
      <DocItemContent {...props} />
      <div style={{ marginTop: '3rem' }}>
        <GiscusComments discussionNumber={frontMatter.discussion} />
      </div>
    </>
  );
}
