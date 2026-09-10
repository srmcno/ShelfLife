// Small vector illustrations, shared by the display cabinet, museum and stage.
// User strings never become SVG markup.
const ink={
 spool:'<path d="M22 20h36v40H22Z" fill="#bb8193"/><ellipse cx="40" cy="20" rx="24" ry="8" fill="#b28b5a"/><ellipse cx="40" cy="60" rx="24" ry="8" fill="#b28b5a"/><path d="M23 30h34M23 39h34M23 49h34" stroke="#e7b4bc"/>',
 ribbon:'<path d="M18 13h44L47 39l15 28H18l15-28Z" fill="#bd859b"/><path d="M21 18h35M22 61h33" stroke="#f1c4ca"/>',
 cord:'<path d="M22 15q40 0 30 18T22 44t33 18" stroke="#dfcba1" stroke-width="7"/><path d="m50 58 9 8m-10-3 8 8" stroke="#dfcba1"/>',
 jar:'<path d="M26 19h28v10q10 6 10 18v18H16V47q0-12 10-18Z" fill="#76adb7"/><path d="M23 14h34v9H23Z" fill="#b9c8b9"/><path d="M25 39v18" stroke="#e3f5eb" stroke-width="4"/><path d="M18 59h44"/>',
 thimble:'<path d="M21 65 27 23q13-18 26 0l6 42Z" fill="#c49472"/><path d="M23 56h34M34 23v2m11-2v2m-15 8v2m11-2v2m10-2v2M28 43v2m11-2v2m13-2v2" stroke="#784d44" stroke-width="3"/>',
 latch:'<path d="M15 25h13v35H15Zm39 0h13v35H54Z" fill="#c99e60"/><path d="M21 39h39v12H21Z" fill="#e1be80"/><path d="M41 29v24" stroke="#8b6744" stroke-width="7"/>',
 spout:'<path d="M19 61h23V43q0-12 24-21L55 12Q24 23 24 40Z" fill="#b1c5c7"/><path d="m52 13 13 11M23 50h19"/>',
 plug:'<ellipse cx="40" cy="56" rx="24" ry="10" fill="#686f72"/><path d="M27 48h26v10H27Z" fill="#93999b"/><path d="M40 46v-7l-8-5 16-5-16-5 16-5-8-5" stroke="#d6c497" stroke-width="3"/>',
 moon:'<path d="M31 13h18v9H31z" fill="#ccb686"/><path d="M32 22v7c-15 11-17 33-6 40h28c11-7 9-29-6-40v-7" fill="#263f57"/><path d="M46 36c-16-1-21 20-7 26 8 2 13-2 15-7-12 2-17-10-8-19Z" fill="#f8dc8b"/><circle cx="29" cy="43" r="2" fill="#fff"/>',
 crown:'<path d="m14 32 13 10 13-22 13 22 13-10-7 32H21Z" fill="#d9b15d"/><path d="M22 55h36M29 61h22"/><circle cx="40" cy="48" r="4" fill="#ba799f"/>',
 bell:'<path d="M37 18h6v10h-6z" fill="#d8c18a"/><path d="M23 53c4-5 1-25 17-25s13 20 17 25l6 7H17Z" fill="#d3af65"/><path d="M32 65q8 9 16 0M31 36q-3 5-3 10"/>',
 paper:'<path d="m23 13 35 3-2 55-34-3Z" fill="#f0dfb9"/><path d="M29 28h18M29 35h19M28 42h12"/><circle cx="45" cy="55" r="8" fill="#9d5c70"/><path d="m42 56 3 3 5-7" stroke="#fff"/>',
 button:'<circle cx="40" cy="43" r="25" fill="#766884"/><circle cx="40" cy="43" r="19"/><path d="m34 37 12 12m0-12L34 49" stroke="#edcca0" stroke-width="3"/>',
 portrait:'<rect x="14" y="14" width="52" height="56" rx="4" fill="#ad8756"/><rect x="21" y="21" width="38" height="42" fill="#293e35"/><path d="M28 56q-7-25 12-26 18 2 13 26Z" fill="#9bb383"/><circle cx="36" cy="42" r="2"/><circle cx="46" cy="42" r="2"/><path d="M49 29q5-17 13-7"/>',
 medal:'<path d="m25 12 8 32h14l9-32-15 6Z" fill="#b56577"/><circle cx="40" cy="51" r="20" fill="#d6b163"/><path d="m40 38 4 9 9 1-7 7 2 9-8-5-8 5 2-9-7-7 9-1Z" fill="#fbe3a3"/>',
 echo:'<path d="M20 45q-5-19 15-19h16q16 0 14 17-2 14-21 12L29 66l2-12q-11-1-11-9" fill="#96cbbb"/><path d="M31 39h21M31 46h13"/><path d="M15 28q-7 17 1 27"/>',
 needle:'<path d="M48 18q5-15 8 0L32 66Z" fill="#d6d5d7"/><path d="M50 21c-33-30-50 26-26 16s20 26 34 13" stroke="#d37f96" stroke-width="3"/><path d="m51 13-2 7"/>',
 clock:'<path d="M25 12h30M25 69h30M28 14c-2 17 9 20 12 26-3 5-14 9-12 27h24c2-18-9-22-12-27 3-6 14-9 12-26" fill="#a7c9cc"/><path d="m32 23 8 12 8-12M31 61l9-17 9 17" fill="#e6c278"/>',
 receipt:'<path d="m24 10 5 4 5-4 5 4 5-4 5 4 7-4v61l-6-5-5 5-5-5-5 5-5-5-6 5Z" fill="#e5d5b1"/><path d="M30 25h19M30 33h13M30 42h19M30 53h17"/><path d="m47 33 4 2"/>',
 rain:'<path d="M20 38c-14-15 5-28 16-20 10-20 32-7 29 7 17 1 16 23-2 24H24" fill="#9bb6c4"/><path d="m27 57-3 8m18-9-3 9m18-8-3 8" stroke="#91d7e0"/><path d="M60 46q12 25-6 27"/>',
 sock:'<path d="M34 12h26v35c-2 9-25 24-36 18-19-9 0-19 10-26Z" fill="#b29aba"/><path d="M36 20h22M36 27h22M26 48l12 12"/>',
 pea:'<circle cx="40" cy="45" r="25" fill="#94ab67"/><path d="m27 22 3-13 10 9 11-9 3 14Z" fill="#dec58a"/><circle cx="32" cy="42" r="2"/><circle cx="49" cy="42" r="2"/><path d="M35 55q6-3 12 0"/>',
 spoon:'<path d="M52 33 30 69q-6 5-7-2l20-38" fill="#a4bac4"/><ellipse cx="53" cy="23" rx="12" ry="18" transform="rotate(30 53 23)" fill="#c3d1d4"/><path d="M53 12q-10 6-9 13"/>',
 sun:'<circle cx="40" cy="41" r="19" fill="#edc96d"/><path d="M40 8v7m0 52v7M8 41h7m50 0h7M17 17l6 6m34 34 6 6M17 65l6-6m34-35 6-6" stroke="#edc96d"/><path d="M34 40h1m11 0h1M33 49q8 7 15 0"/>',
 tooth:'<path d="M20 22c8-16 16-4 20-4s16-12 22 5c5 13-6 45-12 43-5-2-2-24-10-25-8 2-5 24-10 25-5 1-17-31-10-44Z" fill="#ecdfc2"/><path d="m34 21 6 5 6-5"/>',
 key:'<circle cx="31" cy="27" r="16" fill="#cbb77c"/><circle cx="31" cy="27" r="6"/><path d="m40 40 20 25 7-5-6-8-5 3-4-6 5-3-7-10Z" fill="#cbb77c"/>',
 raisin:'<ellipse cx="40" cy="42" rx="17" ry="23" fill="#70516a"/><path d="M33 26q-7 15 0 31m12-33q8 12 0 29m-8-20 4 13" stroke="#a9828c"/><path d="M19 70h43M28 15h25" stroke="#ecdcbf"/>',
 scarf:'<path d="M9 35q31-14 62 0l-3 15q-31-13-56 0Z" fill="#b991ae"/><path d="M18 44v23l13 3V43" fill="#b991ae"/><path d="M15 32v16m12-19v15m14-16v14m14-12v14M19 66v7m6-7v7" stroke="#ead5b0"/>'
};
const guestShape={moth:'moon',lint:'crown',bell:'bell',undertow:'paper',widow:'button',spore:'portrait',tooth:'medal',echo:'echo',needle:'needle',clock:'clock',receipt:'receipt',rain:'rain'};
export function curioSVG(id, {literal=false}={}) {
 const shape=literal?id:guestShape[id]||id;
 return '<svg viewBox="0 0 80 80" class="curio-art" aria-hidden="true" fill="none" stroke="#312637" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ink[shape]||ink.key)+'</svg>';
}
