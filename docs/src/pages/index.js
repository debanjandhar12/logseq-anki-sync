import React, { useEffect } from 'react';
import { useHistory } from '@docusaurus/router';

export default function Home() {
  const history = useHistory();
  
  useEffect(() => {
    history.push('./docs/intro/');
  }, [history]);
  
  return null;
}
