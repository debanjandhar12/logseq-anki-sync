import ohm from "ohm-js";

export const specialChars =
    "\u2ddf\u22b3\u22b0\u278c\u23a1\u230f\u245d\u25da\u2efa\u2b79\u2b4d\u24e8\u2b8e\u2be4\u22cb\u2fed\u2063\u27c9\u24cf\u2904\u24a3\u24d0\u25e7\u22b5\u21da\u20ce\u2435\u2686\u2ba6\u27af\u244e\u23be\u298a\u26b0\u29ec\u2351\u234c\u2e7c\u2236\u243c\u2756\u21bf\u232b\u2936\u2b11\u2798\u20fe";
export const ANKI_CLOZE_REGEXP = /(\{\{c(\d+)::)((.|\n)*?)\}\}/g;
export const MD_MATH_BLOCK_REGEXP = /\$\$([\s\S]*?)\$\$/g;
export const MD_PROPERTIES_REGEXP = /^\s*(\w|-)*::.*\n?\n?/gm;
export const MD_IMAGE_EMBEDED_REGEXP = /!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)/g;
export const ORG_MATH_BLOCK_REGEXP = /\\\[([\s\S]*?)\\\]/g;
export const ORG_PROPERTIES_REGEXP = /:PROPERTIES:\n((.|\n)*?):END:\n?/gm;
export const LOGSEQ_BLOCK_REF_REGEXP = /\(\(([^\)\n]*?)\)\)(?!\))/gm;
export const LOGSEQ_RENAMED_BLOCK_REF_REGEXP = /\[(.*?)\]\(\(\((.*?)\)\)\)/gm;
export const LOGSEQ_RENAMED_PAGE_REF_REGEXP = /\[(.*?)\]\(\[\[(.*?)\]\]\)/gm;
export const LOGSEQ_PAGE_REF_REGEXP = /(?<!#)\[\[(.*?)\]\]/gm;
// The \u2063? is to match the zero-width space that the plugin sometimes add to bypass cloze end.
export const LOGSEQ_EMBDED_PAGE_REGEXP = /\{\{embed \[\[(.*?)\]\] *?\}\u2063?\}/gm;
export const LOGSEQ_EMBDED_BLOCK_REGEXP = /\{\{embed \(\((.*?)\)\) *?\}\u2063?\}/gm;

export const isImage_REGEXP = /^[^?]*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)(\?.*)?$/i;
export const isAudio_REGEXP = /^[^?]*\.(mp3|wav|ogg|flac|aac|opus)(\?.*)?$/i;
export const isWebURL_REGEXP =
    /^(https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;

export const OhmStrToListGrammar = ohm.grammar(String.raw`
    StrRegArray {
        Exp = listOf<StrOrRegex, separator> separator*
        separator = (whitespace)* "," (whitespace)*
        StrOrRegex = (Regex | Str | "")
        Str = "\'" seqStr "\'"
        Regex =  "/" seqReg "/" (letter|lineTerminator)*
        seqReg = (("\\/" |"\\\\"|~("/")  any))+
        seqStr = (("\\\\"|"\\'"| ~("\'")  any))*
            
        // External rules
        whitespace = "\t"
                   | "\x0B"    -- verticalTab
                   | "\x0C"    -- formFeed
                   | " "
                   | "\u00A0"  -- noBreakSpace
                   | "\uFEFF"  -- byteOrderMark
                   | unicodeSpaceSeparator
         unicodeSpaceSeparator = "\u2000".."\u200B" | "\u3000"
         lineTerminator = "\n" | "\r" | "\u2028" | "\u2029"
      }`);

export const ANKI_ICON = `<svg height="1em" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" preserveAspectRatio="xMidYMid meet" viewBox="0 0 197.99999 198" id="svg2" version="1.1" inkscape:version="0.91 r13725" sodipodi:docname="application-icon.svg" enable-background="new" inkscape:export-filename="/home/tim/development/Anki-Android/docs/marketing/android_market/logo512-512-alpha.png" inkscape:export-xdpi="90" inkscape:export-ydpi="90">
<title id="title4207">Anki Flat Design</title>
<sodipodi:namedview id="base" pagecolor="#ffffff" bordercolor="#666666" borderopacity="1.0" inkscape:pageopacity="0.0" inkscape:pageshadow="2" inkscape:zoom="2.8" inkscape:cx="44.732536" inkscape:cy="87.724961" inkscape:document-units="px" inkscape:current-layer="layer5" showgrid="false" units="px" borderlayer="true" inkscape:window-width="1855" inkscape:window-height="1056" inkscape:window-x="65" inkscape:window-y="24" inkscape:window-maximized="1" inkscape:snap-bbox="true" inkscape:snap-bbox-midpoints="true" inkscape:bbox-paths="true" showguides="false" inkscape:snap-bbox-edge-midpoints="true" inkscape:snap-global="true">
  <sodipodi:guide position="0.0,0" orientation="198.0,0" id="guide4139"/>
  <sodipodi:guide position="99.0,0" orientation="198.0,0" id="guide4141"/>
  <sodipodi:guide position="198.0,0" orientation="198.0,0" id="guide4143"/>
  <sodipodi:guide position="0,0.0" orientation="0,198.0" id="guide4145"/>
  <sodipodi:guide position="0,99.0" orientation="0,198.0" id="guide4147"/>
  <sodipodi:guide position="0,198.0" orientation="0,198.0" id="guide4149"/>
</sodipodi:namedview>
<defs id="defs4">
  <linearGradient inkscape:collect="always" id="linearGradient4641">
    <stop style="stop-color:#4d4d4d;stop-opacity:1" offset="0" id="stop4643"/>
    <stop style="stop-color:#666666;stop-opacity:0.46757679" offset="1" id="stop4645"/>
  </linearGradient>
  <linearGradient id="linearGradient4266" inkscape:collect="always">
    <stop id="stop4268" offset="0" style="stop-color:#ffffff;stop-opacity:0.1"/>
    <stop id="stop4270" offset="1" style="stop-color:#ffffff;stop-opacity:0"/>
  </linearGradient>
  <linearGradient id="linearGradient4181" inkscape:collect="always">
    <stop id="stop4183" offset="0" style="stop-color:#0288d1;stop-opacity:1"/>
    <stop id="stop4185" offset="1" style="stop-color:#29b6f6;stop-opacity:1"/>
  </linearGradient>
  <clipPath id="clipPath4168" clipPathUnits="userSpaceOnUse">
    <rect y="794.77325" x="358.60416" height="325.2691" width="263.64981" id="rect4170" style="opacity:1;fill:#fbe9e7;fill-opacity:1;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1"/>
  </clipPath>
  <filter id="filter4246" inkscape:label="Drop Shadow" style="color-interpolation-filters:sRGB">
    <feFlood id="feFlood4248" result="flood" flood-color="rgb(255,255,255)" flood-opacity="0.2"/>
    <feComposite id="feComposite4250" result="composite1" operator="in" in2="flood" in="SourceGraphic"/>
    <feGaussianBlur id="feGaussianBlur4252" result="blur" stdDeviation="4" in="composite1"/>
    <feOffset id="feOffset4254" result="offset" dy="4" dx="2.77556e-017"/>
    <feComposite id="feComposite4256" result="composite2" operator="atop" in2="offset" in="offset"/>
  </filter>
  <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="matrix(-7.8502812e-7,3.09375,-3.0937492,-1.2165089e-6,2721.5333,854.36325)" r="64" fy="879.68774" fx="-6.4646401e-006" cy="879.68774" cx="-6.4646401e-006" id="radialGradient4272" xlink:href="#linearGradient4266" inkscape:collect="always"/>
  <filter id="filter5200" inkscape:label="Drop Shadow" style="color-interpolation-filters:sRGB">
    <feFlood id="feFlood5202" result="flood" flood-color="rgb(62,62,62)" flood-opacity="0.2"/>
    <feComposite id="feComposite5204" result="composite1" operator="in" in2="SourceGraphic" in="flood"/>
    <feGaussianBlur id="feGaussianBlur5206" result="blur" stdDeviation="4" in="composite1"/>
    <feOffset id="feOffset5208" result="offset" dy="4" dx="2.77556e-017"/>
    <feComposite id="feComposite5210" result="composite2" operator="atop" in2="offset" in="offset"/>
  </filter>
  <filter id="filter5330" inkscape:label="Drop Shadow" style="color-interpolation-filters:sRGB">
    <feFlood id="feFlood5332" result="flood" flood-color="rgb(0,0,0)" flood-opacity="0.2"/>
    <feComposite id="feComposite5334" result="composite1" operator="out" in2="SourceGraphic" in="flood"/>
    <feGaussianBlur id="feGaussianBlur5336" result="blur" stdDeviation="0" in="composite1"/>
    <feOffset id="feOffset5338" result="offset" dy="-1" dx="2.77556e-017"/>
    <feComposite id="feComposite5340" result="composite2" operator="in" in2="SourceGraphic" in="offset"/>
  </filter>
  <filter id="filter5590" inkscape:label="Drop Shadow" style="color-interpolation-filters:sRGB">
    <feFlood id="feFlood5592" result="flood" flood-color="rgb(0,69,111)" flood-opacity="0.2"/>
    <feComposite id="feComposite5594" result="composite1" operator="out" in2="SourceGraphic" in="flood"/>
    <feGaussianBlur id="feGaussianBlur5596" result="blur" stdDeviation="0" in="composite1"/>
    <feOffset id="feOffset5598" result="offset" dy="-1" dx="2.77556e-017"/>
    <feComposite id="feComposite5600" result="composite2" operator="atop" in2="SourceGraphic" in="offset"/>
  </filter>
  <filter id="filter6198" inkscape:label="Drop Shadow" style="color-interpolation-filters:sRGB">
    <feFlood id="feFlood6200" result="flood" flood-color="rgb(255,255,255)" flood-opacity="0.2"/>
    <feComposite id="feComposite6202" result="composite1" operator="out" in2="SourceGraphic" in="flood"/>
    <feGaussianBlur id="feGaussianBlur6204" result="blur" stdDeviation="0" in="composite1"/>
    <feOffset id="feOffset6206" result="offset" dy="1" dx="2.77556e-017"/>
    <feComposite id="feComposite6208" result="fbSourceGraphic" operator="atop" in2="SourceGraphic" in="offset"/>
    <feColorMatrix id="feColorMatrix6222" values="0 0 0 -1 0 0 0 0 -1 0 0 0 0 -1 0 0 0 0 1 0" in="fbSourceGraphic" result="fbSourceGraphicAlpha"/>
    <feFlood in="fbSourceGraphic" result="flood" flood-color="rgb(0,0,0)" flood-opacity="0.2" id="feFlood6224"/>
    <feComposite result="composite1" operator="out" in="flood" in2="fbSourceGraphic" id="feComposite6226"/>
    <feGaussianBlur result="blur" stdDeviation="0" in="composite1" id="feGaussianBlur6228"/>
    <feOffset result="offset" dy="-1" dx="2.77556e-017" id="feOffset6230"/>
    <feComposite result="composite2" operator="atop" in="offset" in2="fbSourceGraphic" id="feComposite6232"/>
  </filter>
  <filter id="filter6378" inkscape:label="Drop Shadow" style="color-interpolation-filters:sRGB">
    <feFlood id="feFlood6380" result="flood" flood-color="rgb(255,255,255)" flood-opacity="0.5"/>
    <feComposite id="feComposite6382" result="composite1" operator="out" in2="SourceGraphic" in="flood"/>
    <feGaussianBlur id="feGaussianBlur6384" result="blur" stdDeviation="0" in="composite1"/>
    <feOffset id="feOffset6386" result="offset" dy="1" dx="2.77556e-017"/>
    <feComposite id="feComposite6388" result="composite2" operator="in" in2="SourceGraphic" in="offset"/>
  </filter>
  <linearGradient y2="1022.263" x2="83.887375" y1="942.79626" x1="94.9618" gradientTransform="matrix(0.97143611,-0.13537864,0.13537864,0.97143611,-132.14655,37.991055)" gradientUnits="userSpaceOnUse" id="linearGradient6395" xlink:href="#linearGradient4181" inkscape:collect="always"/>
  <linearGradient y2="939.29724" x2="134.55711" y1="895.45349" x1="113.67747" gradientTransform="matrix(0.87513004,0.41676225,-0.41676225,0.87513004,393.8871,57.480241)" gradientUnits="userSpaceOnUse" id="linearGradient6397" xlink:href="#linearGradient4181" inkscape:collect="always"/>
  <clipPath clipPathUnits="userSpaceOnUse" id="clipPath4629">
    <rect style="display:inline;opacity:1;fill:#666666;fill-opacity:1;stroke:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" id="rect4631" width="128" height="172" x="35.000004" y="13.000023" rx="16"/>
  </clipPath>
  <linearGradient inkscape:collect="always" xlink:href="#linearGradient4641" id="linearGradient4647" x1="99" y1="99.000023" x2="224.2589" y2="161.62946" gradientUnits="userSpaceOnUse"/>
</defs>
<metadata id="metadata7">
  <rdf:RDF>
    <cc:Work rdf:about="">
      <dc:format>
        image/svg+xml
      </dc:format>
      <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage"/>
      <dc:title>
        Anki Flat Design
      </dc:title>
      <cc:license rdf:resource="http://creativecommons.org/licenses/by/3.0/"/>
      <dc:creator>
        <cc:Agent>
          <dc:title>
            not7CD
          </dc:title>
        </cc:Agent>
      </dc:creator>
      <dc:description>
        not7CD.pl
      </dc:description>
    </cc:Work>
    <cc:License rdf:about="http://creativecommons.org/licenses/by/3.0/">
      <cc:permits rdf:resource="http://creativecommons.org/ns#Reproduction"/>
      <cc:permits rdf:resource="http://creativecommons.org/ns#Distribution"/>
      <cc:requires rdf:resource="http://creativecommons.org/ns#Notice"/>
      <cc:requires rdf:resource="http://creativecommons.org/ns#Attribution"/>
      <cc:permits rdf:resource="http://creativecommons.org/ns#DerivativeWorks"/>
    </cc:License>
  </rdf:RDF>
</metadata>
<g style="display:inline" inkscape:label="Card" inkscape:groupmode="layer" id="layer1" transform="translate(0,-854.36216)"/>
<g sodipodi:insensitive="true" style="display:none" inkscape:label="Finish" id="layer4" inkscape:groupmode="layer">
  <rect rx="16" y="867.36218" x="34.999996" height="172" width="128" id="rect4192" style="display:inline;opacity:1;fill:url(#radialGradient4272);fill-opacity:1;stroke:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" transform="translate(7.6293945e-6,-854.36216)"/>
</g>
<g inkscape:groupmode="layer" id="layer6" inkscape:label="LongShadow" style="opacity:1"/>
<g style="display:inline" inkscape:label="Stars" id="layer5" inkscape:groupmode="layer">
  <g id="g3410" transform="translate(-8.7624731,0)">
    <rect style="display:inline;opacity:1;fill:#666666;fill-opacity:1;stroke:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" id="rect4162" width="145.52492" height="195.5491" x="34.999996" y="855.81305" rx="18.190615" transform="translate(7.6293945e-6,-854.36216)"/>
    <path transform="matrix(1.1369134,0,0,1.1369134,-4.7919614,-13.328985)" inkscape:connector-curvature="0" clip-path="url(#clipPath4629)" id="path4332" d="m 133.86719,36.148438 c -3.17677,-0.288864 -7.82002,7.359765 -11.05274,7.960937 -3.44823,0.64127 -11.27475,-5.623735 -13.6875,-3.078125 -2.41275,2.54561 4.26233,10.026286 3.80664,13.503906 -0.45568,3.47763 -8.8317,8.985107 -7.15625,12.066406 0.0844,0.155164 0.18792,0.291428 0.3086,0.41211 L 318.21875,279.14648 c 1.7413,1.7413 7.07575,0.068 10.83594,-0.17578 l 10.08984,10.08985 c 0.65625,0.58538 1.33604,0.89427 2.04883,0.76172 3.44823,-0.64127 2.44467,-10.6165 4.85742,-13.16211 2.41275,-2.5456 12.42712,-2.07707 12.88281,-5.55469 0.0948,-0.72364 -0.25525,-1.39002 -0.88281,-2.01758 l -10.55469,-10.55273 c 0,0 0,-0.002 0,-0.002 0.21836,-3.61192 1.18995,-8.15967 -0.38086,-9.73047 L 134.98242,36.669922 c -0.14447,-0.144469 -0.30964,-0.26286 -0.5,-0.353516 -0.19791,-0.09425 -0.40345,-0.148711 -0.61523,-0.167968 z M 84.710938,88.658203 c -0.188085,-0.0077 -0.379919,5.42e-4 -0.572266,0.02734 -6.155121,0.85776 -5.180838,18.594407 -9.65625,22.906257 -4.47541,4.31185 -22.163753,2.67795 -23.25,8.79687 -0.247777,1.39576 0.454834,2.71069 1.71875,3.97461 l 17.675781,17.67578 c -0.445623,6.6333 -3.198221,15.85256 -0.166015,18.88477 L 282.59375,373.05469 c 0.22013,0.22013 0.47166,0.409 0.75586,0.56054 5.48379,2.924 15.12027,-11.99776 21.27539,-12.85546 6.15513,-0.8579 19.50505,10.86062 23.98047,6.54882 4.4754,-4.3119 -6.73664,-18.09005 -5.65039,-24.20898 1.08625,-6.11893 16.35454,-15.19439 13.63672,-20.7832 -0.15931,-0.32761 -0.36772,-0.61382 -0.61719,-0.86329 L 123.84375,109.32031 c -2.82418,-2.82417 -11.09471,-0.92329 -17.54297,-0.51562 L 87.511719,90.015625 c -0.888073,-0.817279 -1.815637,-1.317001 -2.800781,-1.357422 z" style="display:inline;opacity:0.46799999;fill:url(#linearGradient4647);fill-opacity:1;stroke:none;stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1"/>
    <g id="g5190" transform="matrix(1.1369134,0,0,1.1369134,-3.5527153,-14.164677)">
      <path inkscape:connector-curvature="0" id="path4164" d="m 83.049581,943.78215 c 6.155121,-0.85778 10.067566,16.46925 15.55135,19.39319 5.483779,2.92393 22.051249,-3.48327 24.769079,2.10553 2.71782,5.58881 -12.55215,14.66411 -13.6384,20.78304 -1.08625,6.11893 10.127,19.89549 5.6516,24.20739 -4.47542,4.3118 -17.825218,-7.4064 -23.980342,-6.5485 -6.155121,0.8577 -15.79242,15.7794 -21.276207,12.8554 -5.483788,-2.924 1.535552,-19.24149 -1.182277,-24.83021 -2.717829,-5.5888 -19.887254,-10.14337 -18.801009,-16.26232 1.086247,-6.11892 18.774248,-4.48553 23.249658,-8.79738 4.475412,-4.31185 3.501427,-22.04838 9.656548,-22.90614 z" inkscape:transform-center-y="-2.8065976" inkscape:transform-center-x="1.6436305" style="display:inline;opacity:1;fill:url(#linearGradient6395);fill-opacity:1;stroke:#ffffff;stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" transform="translate(7.6293945e-6,-854.36216)"/>
      <path inkscape:connector-curvature="0" id="path4164-3" d="m 133.39163,891.41316 c 3.1666,1.50803 -0.37288,10.8875 1.30256,13.9688 1.67543,3.0813 11.47206,5.20934 11.01637,8.68697 -0.45569,3.47762 -10.46986,3.0098 -12.88261,5.5554 -2.41275,2.54561 -1.40932,12.52035 -4.85755,13.16162 -3.44823,0.64125 -6.09784,-9.02735 -9.26445,-10.53538 -3.16659,-1.50801 -12.34306,2.52866 -14.01849,-0.55263 -1.67545,-3.0813 6.70117,-8.589 7.15685,-12.06663 0.45569,-3.47762 -6.21911,-10.95755 -3.80636,-13.50316 2.41275,-2.54561 10.2394,3.71905 13.68763,3.07778 3.44823,-0.64125 8.49945,-9.3008 11.66605,-7.79277 z" inkscape:transform-center-y="0.35457901" inkscape:transform-center-x="-1.3524214" style="display:inline;opacity:1;fill:url(#linearGradient6397);fill-opacity:1;stroke:#ffffff;stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" transform="translate(7.6293945e-6,-854.36216)"/>
    </g>
  </g>
</g>
</svg>`;

export const SETTINGS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-settings" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>`;

export const DONATE_ICON =
    "https://img.shields.io/github/sponsors/debanjandhar12.svg?logo=github&style=flat&height=60&label=Donate&cacheSeconds=28800&color=orange" ||
    `data:image/png;base64, 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`;

export const GRAPH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-hierarchy" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><circle cx="12" cy="5" r="2"></circle><circle cx="5" cy="19" r="2"></circle><circle cx="19" cy="19" r="2"></circle><path d="M6.5 17.5l5.5 -4.5l5.5 4.5"></path><line x1="12" y1="7" x2="12" y2="13"></line></svg>`;

export const LOGSEQ_ICON = `<svg width="1em" height="1em" viewBox="0 0 128 128" id="svg16" sodipodi:docname="logseq_icon_simple.svg" inkscape:version="1.1.2 (0a00cf5339, 2022-02-04)" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><rect x="4.55" y="4.837" width="118.9" height="118.33" rx="27.073" ry="30.829" enable-background="new" fill="#002b34" stroke-width="1.0408" style="" id="rect4"/><g transform="translate(249.20942,50.168715)" fill="#86c8c8" id="g14"><path transform="rotate(41.244)" d="m -156.95,133.24 a 17.127,15.341 0 0 1 -17.095,15.341 17.127,15.341 0 0 1 -17.158,-15.285 17.127,15.341 0 0 1 17.033,-15.397 17.127,15.341 0 0 1 17.22,15.229" id="path8"/><ellipse cx="-174.02" cy="30.698" rx="38.706001" ry="30.240999" id="ellipse10"/><ellipse transform="matrix(0.98259,-0.18578,0.15255,0.9883,0,0)" cx="-172.09" cy="-55.007999" rx="16.385" ry="10.568" id="ellipse12"/></g></svg>`;
export const ADD_OCCLUSION_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-square-plus-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12.5 21h-7.5a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v7.5" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>`;

export const REMOVE_OCCLUSION_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-square-minus" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12.5 21h-7.5a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10" /><path d="M16 19h6" /></svg>`;

export const SUCCESS_ICON = `<span class="text-success"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-circle-check" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><circle cx="12" cy="12" r="9"></circle><path d="M9 12l2 2l4 -4"></path></svg></span>`;

export const WARNING_ICON = `<span class="text-warning"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-alert-circle" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></span>`;
