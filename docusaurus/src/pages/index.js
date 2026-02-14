import React, {useEffect} from "react";
import Head from "@docusaurus/Head";
import {useHistory} from "@docusaurus/router";

export default function Home() {
    const history = useHistory();

    useEffect(() => {
        history.replace("./docs/intro");
    }, [history]);

    return (
        <Head>
            <meta httpEquiv="refresh" content="0; url=./docs/intro" />
            <link rel="canonical" href="./docs/intro" />
        </Head>
    );
}
