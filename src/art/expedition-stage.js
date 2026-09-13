// Authored miniature sets. The route chooses the material, light and scale;
// the actual saved crew and recovered objects are mounted by the view.
const DRAWER = `
 <path fill="#35252a" d="M0 0h1000v500H0z"/>
 <path fill="#694239" d="M22 20h956v356H22z"/>
 <path fill="#80513e" d="M36 34h928v328H36z"/>
 <path fill="#9a6447" d="M0 376 82 318h838l80 58v124H0z"/>
 <g fill="none" stroke="#b07a54" stroke-width="3" opacity=".5"><path d="M40 89q260-21 468 0t455-4M36 151q230 20 489-1t439 3M36 270q240-20 477 0t448-4M0 435q315-34 530-2t470-5M80 350q323-24 835 1"/></g>
 <path fill="#412a31" d="m74 33 210-5 15 271-229 7z"/>
 <path fill="#b19baa" d="m104 43 109-7 14 134c2 25-34 62-77 61-59-2-42-39-17-64z"/>
 <path fill="none" stroke="#d8bbbd" stroke-width="9" d="m108 69 102-7m-99 26 101-7m-86 97 39 28"/>
 <path fill="#bd9c7e" d="m343 80 164-9 9 131-163 13z"/>
 <path fill="#614b46" d="m358 94 134-6 6 43-133 8z"/>
 <path fill="none" stroke="#8e725e" stroke-width="4" d="m367 161 116-8m-112 24 73-5"/>
 <circle cx="422" cy="80" r="7" fill="#d7b474"/>
 <path fill="none" stroke="#d1ab7b" stroke-width="6" d="M293 0q7 41 113 36t173 18 210-26"/>
 <g stroke="#30282d" stroke-width="5"><path fill="#75606c" d="m540 168 97-6 5 149-101 4z"/><ellipse cx="590" cy="165" rx="66" ry="19" fill="#b98e60"/><ellipse cx="593" cy="312" rx="66" ry="19" fill="#b98e60"/></g>
 <g stroke="#d2a6b6" stroke-width="4" opacity=".8"><path d="m551 198 77-6m-76 22 77-6m-76 22 77-6m-76 22 77-6m-76 22 77-6"/></g>
 <path fill="#3d3030" d="M756 85h99v210h-99z"/>
 <path fill="#dbb985" d="M768 96h76v188h-76z"/>
 <path fill="#9d7460" d="M777 107h58v128h-58z"/>
 <ellipse cx="806" cy="164" rx="19" ry="27" fill="#695464"/>
 <path fill="#625049" d="m927 0 24 0v341h-24z"/>
 <path fill="url(#expedition-drawer-light)" d="M896 26 520 387h480V23z"/>
 <path fill="#513330" d="M0 462h1000v38H0z"/>
 <path stroke="#c08d59" stroke-width="5" d="M0 465h1000"/>
 <ellipse cx="480" cy="405" rx="310" ry="32" fill="#3b242b" opacity=".22"/>
 <g fill="#d9b884"><circle cx="63" cy="395" r="4"/><circle cx="887" cy="415" r="3"/><circle cx="451" cy="367" r="2"/></g>`;

const FRIDGE = `
 <path fill="#183438" d="M0 0h1000v500H0z"/>
 <path fill="#2d5355" d="M21 25h958v340H21z"/>
 <path fill="#54817f" d="M39 38h924v304H39z"/>
 <path fill="#759997" d="m0 372 73-63h854l73 63v128H0z"/>
 <path fill="#93b9ae" d="M85 0h39v311H85z"/>
 <g stroke="#acc9bd" stroke-width="2" opacity=".35"><path d="m143 37 66 77m-50-67 238 276M377 40l146 173M838 40l116 141M504 50l77 89M0 397h1000M18 437h960"/></g>
 <path fill="#afc7b6" stroke="#294c51" stroke-width="7" d="M704 58h143v24q20 21 20 63v173H683V145q0-41 21-63z"/>
 <rect x="692" y="31" width="166" height="38" rx="8" fill="#799897" stroke="#294c51" stroke-width="6"/>
 <path fill="#decb9b" d="M704 151h142v93H704z"/>
 <path fill="#5c8d78" d="M756 178q42-19 44 23 0 25-40 26-39-4-27-31z"/>
 <path stroke="#eef4d8" stroke-width="10" opacity=".7" stroke-linecap="round" d="M710 92q-13 17-13 42v112"/>
 <path fill="#d7d0ad" stroke="#355d5c" stroke-width="6" d="M217 268h178l35 68H190z"/>
 <path fill="#e8dfbd" d="m217 268 30-125h123l25 125z"/>
 <path fill="#728974" d="M254 155h109l15 78H237z"/>
 <g fill="#baae70"><circle cx="260" cy="191" r="11"/><circle cx="329" cy="178" r="8"/><circle cx="343" cy="219" r="7"/></g>
 <path fill="#7caaaa" stroke="#2b5357" stroke-width="7" d="M441 203h145l-16 130H458z"/>
 <ellipse cx="514" cy="202" rx="78" ry="13" fill="#bacbc0"/>
 <path fill="#d2b580" d="m498 223 34-3 2 63-34 4z"/>
 <path fill="#213f44" d="M16 365h968v20H16z"/>
 <path fill="#c1d2be" opacity=".25" d="m143 0 58 0 440 413-252 4z"/>
 <path fill="#e5ebc5" d="M82 0h48v49q-24 20-48 0z"/>
 <path fill="url(#expedition-fridge-light)" d="M40 0h525v480H40z"/>
 <ellipse cx="496" cy="425" rx="362" ry="25" fill="#173c43" opacity=".2"/>
 <g fill="#b9d4c2"><path d="m64 430 23-25 28 23zM824 448l31-24 18 25zM932 380l12-17 21 19z"/></g>
 <path fill="#254c4e" d="M0 467h1000v33H0z"/>
 <path stroke="#9ebdae" stroke-width="6" d="M0 470h1000"/>`;

const CUPBOARD = `
 <path fill="#292e30" d="M0 0h1000v500H0z"/>
 <path fill="#555146" d="M23 20h954v335H23z"/>
 <path fill="#74715a" d="M42 36h916v310H42z"/>
 <path fill="#99927a" d="M0 375 73 315h854l73 60v125H0z"/>
 <g fill="none" stroke="#aea588" stroke-width="3" opacity=".3"><path d="M150 40v307M344 39v307M540 38v308M738 38v307M934 38v308M0 426q289-31 517 0t482-8"/></g>
 <path fill="#393e36" d="M107 157h121v184H107z"/>
 <path fill="#b19c70" d="M115 117h104v211H115z"/>
 <path fill="#e0cf9f" d="M112 115h110v25H112z"/>
 <path fill="#63736a" d="m125 184 84-7v96l-85 5z"/>
 <path fill="#baac7d" d="m157 202 25 0v53h-25z"/>
 <path fill="none" stroke="#bfb291" stroke-width="10" d="M639 204q100-37 88 73-4 34-51 39"/>
 <path fill="#a47d58" stroke="#3d453f" stroke-width="7" d="M497 202q-18 21-18 57 0 95 101 96 103-1 103-93 0-38-20-60z"/>
 <ellipse cx="581" cy="201" rx="90" ry="18" fill="#d4b47b" stroke="#3d453f" stroke-width="6"/>
 <path fill="#5c6856" stroke="#3d453f" stroke-width="7" d="M533 200q-15-54 46-55 57 0 51 54z"/>
 <path fill="#cfab76" d="m489 265-81-44-17 15 93 84z"/>
 <path stroke="#e5bd84" stroke-width="12" stroke-linecap="round" opacity=".7" d="M504 243q-6 63 34 85"/>
 <path fill="#a7b4a0" stroke="#414d48" stroke-width="6" d="M815 157h94l-9 164h-77z"/>
 <path fill="none" stroke="#c9ceae" stroke-width="8" d="M849 62q-24 37 9 79m22-67q22 34-7 78"/>
 <path fill="#384039" d="M295 294h89v54h-89z"/>
 <path fill="#baa66f" d="m289 292 54-79 50 82z"/>
 <path fill="#d6c18c" d="M283 298h110v14H283z"/>
 <path fill="#293e38" d="M28 351h944v20H28z"/>
 <path fill="url(#expedition-cupboard-light)" d="M0 0h550v480H0z"/>
 <path stroke="#b4b68c" stroke-width="3" opacity=".5" d="M32 87q358 31 944-22"/>
 <g fill="#d6c997"><path d="m198 84 12 24 12-24M294 87l12 24 12-24M386 85l12 24 12-24"/></g>
 <ellipse cx="507" cy="418" rx="332" ry="24" fill="#273d37" opacity=".23"/>
 <path fill="#454b3e" d="M0 466h1000v34H0z"/>
 <path stroke="#c0ab7d" stroke-width="6" d="M0 468h1000"/>`;

export function expeditionSet(route) {
 const key=['drawer','fridge','cupboard'].includes(route)?route:'drawer';
 const glow=key==='drawer'?'#edcb8e':key==='fridge'?'#f0f4c6':'#f3dba3';
 return '<svg class="expedition-set" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="expedition-'+key+'-light"><stop stop-color="'+glow+'" stop-opacity=".22"/><stop offset="1" stop-color="'+glow+'" stop-opacity="0"/></radialGradient></defs>'+(key==='drawer'?DRAWER:key==='fridge'?FRIDGE:CUPBOARD)+'</svg>';
}

export function expeditionTool(gear) {
 const drawing=gear==='biscuit'?'<path fill="#bd9356" d="m22 15 30-3 15 20-6 30-31 7-20-22z"/><path fill="#e3b674" d="m27 21 24-3 10 17-5 22-24 6-16-17z"/><g fill="#91653f"><circle cx="29" cy="35" r="3"/><circle cx="47" cy="30" r="3"/><circle cx="39" cy="48" r="3"/><circle cx="52" cy="50" r="2"/><circle cx="26" cy="51" r="2"/></g>':gear==='lantern'?'<path fill="none" stroke="#d6b88a" stroke-width="5" d="M29 22V16q11-16 22 0v6"/><path fill="#726151" d="M22 22h36l-4 10 7 32H19l7-32z"/><path fill="#f0d696" d="m30 34-5 24h30l-5-24z"/><path fill="#aa926b" d="M18 64h44v7H18zM22 23h36v7H22z"/><path fill="#fff3c1" d="M37 39h6l3 16H34z"/>':'<path fill="#aa746e" d="M13 28h27v35H13z"/><ellipse cx="26" cy="27" rx="20" ry="7" fill="#bd9e70"/><ellipse cx="26" cy="63" rx="20" ry="7" fill="#bd9e70"/><path fill="none" stroke="#dcb6ae" stroke-width="3" d="M14 36h25M14 43h25M14 50h25M36 49q19-35 30-27t-6 42q-3 5-6 0l-5-15"/><path fill="none" stroke="#d3d4c4" stroke-width="4" stroke-linecap="round" d="m54 65 15-43q1-8-6-6-7 1-4 8l9 32q2 8-6 9z"/>';
 return '<svg viewBox="0 0 80 80" class="expedition-tool-art" aria-hidden="true">'+drawing+'</svg>';
}
