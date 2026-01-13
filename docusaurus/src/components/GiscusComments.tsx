import React from 'react';
import Giscus from '@giscus/react';
import { useColorMode } from '@docusaurus/theme-common';

export default function GiscusComments({ discussionNumber }) {
  const { colorMode } = useColorMode();

  return (
    <Giscus
      repo="debanjandhar12/logseq-anki-sync"
      repoId="R_kgDOGqWYhA"
      category="Documentation"
      categoryId="DIC_kwDOGqWYhM4CUl_j"
      mapping={discussionNumber ? "number" : "pathname"}
      term={discussionNumber ? String(discussionNumber) : undefined}
      strict="0"
      reactionsEnabled="0"
      emitMetadata="0"
      inputPosition="top"
      theme={colorMode === 'dark' ? 'dark' : 'light'}
      lang="en"
      loading="lazy"
    />
  );
}
