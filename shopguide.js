import { useState, useEffect, useRef } from "react";

const LANGS = ["de","fr","it","sr","hu","ro","en","cs"];
const BUILT_IN = {
  de:{next:"Weiter →",prev:"← Zurück",done:"Fertig ✓",close:"Schließen"},
  fr:{next:"Suivant →",prev:"← Retour",done:"Terminer ✓",close:"Fermer"},
  it:{next:"Avanti →",prev:"← Indietro",done:"Fine ✓",close:"Chiudi"},
  sr:{next:"Даље →",prev:"← Назад",done:"Готово ✓",close:"Затвори"},
  hu:{next:"Tovább →",prev:"← Vissza",done:"Kész ✓",close:"Bezárás"},
  ro:{next:"Înainte →",prev:"← Înapoi",done:"Finalizat ✓",close:"Închide"},
  en:{next:"Next →",prev:"← Back",done:"Done ✓",close:"Close"},
  cs:{next:"Dále →",prev:"← Zpět",done:"Hotovo ✓",close:"Zavřít"},
};

const DEFAULT_THEME = {
  primary:"#2563EB",primaryText:"#ffffff",background:"#ffffff",
  text:"#111827",textMuted:"#6B7280",border:"#E5E7EB",
  borderRadius:"12px",fontFamily:"-apple-system, Inter, sans-serif",
  fontSize:"14px",shadow:"0 8px 30px rgba(0,0,0,0.12)",
  backdropColor:"rgba(0,0,0,0.45)",
  beaconColor:"",beaconSize:12,beaconPosition:"top-right",
};

const uid = () => Math.random().toString(36).slice(2,9);
const EMPTY_STEP  = () => ({id:uid(),target:"",title:{},body:{},position:"bottom",button:null});
const EMPTY_FLOW  = () => ({id:"flow-"+uid(),folderId:null,autoStart:false,once:true,urlPattern:"",delay:500,steps:[EMPTY_STEP()]});
const EMPTY_FOLDER= () => ({id:"folder-"+uid(),name:"Neuer Ordner",color:"#6B7280",expanded:true});

// ── Storage helpers ──────────────────────────────────────────────────────────
const STORE_KEY = "shopguide_builder_state";
function loadState() {
  try {
    const raw = window.storage ? null : null; // placeholder
    const ls = typeof window !== "undefined" ? window.sessionStorage?.getItem(STORE_KEY) : null;
    return ls ? JSON.parse(ls) : null;
  } catch { return null; }
}
function saveState(state) {
  try { window.sessionStorage?.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

// ── Persistent storage via window.storage API ────────────────────────────────
async function persistSave(folders, flows, theme) {
  try {
    await window.storage.set(STORE_KEY, JSON.stringify({folders,flows,theme}));
  } catch {}
}
async function persistLoad() {
  try {
    const r = await window.storage.get(STORE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

// ── Colour pills for folders ─────────────────────────────────────────────────
const FOLDER_COLORS = ["#6B7280","#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#0891B2"];

// ── Beacon preview ───────────────────────────────────────────────────────────
function BeaconPreview({color,size}) {
  const c = color||"#2563EB";
  return (
    <div style={{position:"relative",width:size*4,height:size*4,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{position:"absolute",borderRadius:"50%",width:size,height:size,background:c,opacity:0,animation:`sgpulse 1.8s ease-out ${(i-1)*0.6}s infinite`}}/>
      ))}
      <div style={{width:size,height:size,borderRadius:"50%",background:c,position:"relative",zIndex:1}}/>
      <style>{`@keyframes sgpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(3.2);opacity:0}}`}</style>
    </div>
  );
}

// ── Tooltip preview ──────────────────────────────────────────────────────────
function TooltipPreview({step,stepIdx,totalSteps,theme,lang}) {
  const str = BUILT_IN[lang]||BUILT_IN.en;
  const title = step.title?.[lang]||step.title?.en||Object.values(step.title||{})[0]||"";
  const body  = step.body?.[lang] ||step.body?.en ||Object.values(step.body||{})[0] ||"";
  const btnL  = step.button?(step.button.label?.[lang]||step.button.label?.en||Object.values(step.button?.label||{})[0]||""):null;
  const isLast= stepIdx===totalSteps-1;
  const bc    = theme.beaconColor||theme.primary;
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <div style={{position:"absolute",top:-theme.beaconSize/2,right:-theme.beaconSize/2,width:theme.beaconSize*4,height:theme.beaconSize*4,display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,pointerEvents:"none"}}>
        <BeaconPreview color={bc} size={theme.beaconSize}/>
      </div>
      <div style={{background:theme.background,border:`1px solid ${theme.border}`,borderRadius:theme.borderRadius,boxShadow:theme.shadow,fontFamily:theme.fontFamily,fontSize:theme.fontSize,color:theme.text,padding:"20px",maxWidth:290,minWidth:230,boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
          <p style={{margin:0,fontWeight:600,fontSize:15,lineHeight:1.3}}>{title||<span style={{color:theme.border}}>Kein Titel</span>}</p>
          <span style={{color:theme.textMuted,fontSize:18,cursor:"pointer"}}>×</span>
        </div>
        {body&&<p style={{margin:"0 0 14px",color:theme.textMuted,lineHeight:1.55,fontSize:13}}>{body}</p>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          {totalSteps>1&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {Array.from({length:totalSteps},(_,i)=>(
                <span key={i} style={{width:6,height:6,borderRadius:"50%",display:"inline-block",background:i===stepIdx?theme.primary:i<stepIdx?theme.primary+"66":theme.border,transform:i===stepIdx?"scale(1.3)":"scale(1)",transition:"all .2s"}}/>
              ))}
              <span style={{fontSize:12,color:theme.textMuted}}>{stepIdx+1}/{totalSteps}</span>
            </div>
          )}
          {btnL&&<span style={{color:theme.primary,fontSize:12,fontWeight:500}}>{btnL} →</span>}
          <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
            {stepIdx>0&&<button style={{padding:"6px 12px",borderRadius:8,fontSize:12,background:"transparent",border:`1px solid ${theme.border}`,color:theme.textMuted,cursor:"pointer"}}>{str.prev}</button>}
            <button style={{padding:"6px 12px",borderRadius:8,fontSize:12,background:theme.primary,color:theme.primaryText,border:"none",cursor:"pointer"}}>{isLast?str.done:str.next}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Build export config ──────────────────────────────────────────────────────
function buildConfig(flows,theme) {
  const ct = Object.fromEntries(Object.entries(theme).filter(([k,v])=>DEFAULT_THEME[k]!==v&&v!==""));
  return {
    ...(Object.keys(ct).length>0?{theme:ct}:{}),
    flows: flows.map(f=>({
      id:f.id,autoStart:f.autoStart,once:f.once,
      ...(f.urlPattern?{urlPattern:f.urlPattern}:{}),
      ...(f.delay?{delay:f.delay}:{}),
      steps:f.steps.map(s=>({
        ...(s.target?{target:s.target}:{}),
        title:Object.keys(s.title).length===1?Object.values(s.title)[0]:s.title,
        body: Object.keys(s.body).length ===1?Object.values(s.body)[0] :s.body,
        position:s.position,
        ...(s.button?{button:s.button}:{}),
      })),
    })),
  };
}

// ── Inline editable label ────────────────────────────────────────────────────
function InlineEdit({value,onSave,style={}}) {
  const [editing,setEditing] = useState(false);
  const [val,setVal] = useState(value);
  const ref = useRef();
  useEffect(()=>{ if(editing) ref.current?.select(); },[editing]);
  if(!editing) return (
    <span style={{cursor:"text",...style}} onDoubleClick={()=>setEditing(true)} title="Doppelklick zum Umbenennen">{value}</span>
  );
  return (
    <input ref={ref} autoFocus value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={()=>{ onSave(val); setEditing(false); }}
      onKeyDown={e=>{ if(e.key==="Enter"){onSave(val);setEditing(false);} if(e.key==="Escape")setEditing(false); }}
      style={{border:"none",borderBottom:"1px solid #2563EB",outline:"none",background:"transparent",fontSize:"inherit",fontWeight:"inherit",color:"inherit",width:120,...style}}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [ready,setReady]           = useState(false);
  const [folders,setFolders]       = useState([]);
  const [flows,setFlows]           = useState([EMPTY_FLOW()]);
  const [theme,setTheme]           = useState({...DEFAULT_THEME});
  const [activeFlowId,setAFId]     = useState(null);
  const [activeStepIdx,setASI]     = useState(0);
  const [tab,setTab]               = useState("builder");
  const [editLang,setELang]        = useState("de");
  const [previewLang,setPLang]     = useState("de");
  const [copied,setCopied]         = useState(false);
  const [dragging,setDragging]     = useState(null);   // flowId being dragged
  const [dragOver,setDragOver]     = useState(null);   // folderId hovered
  const [showNewFolder,setShowNF]  = useState(false);
  const [newFolderName,setNFName]  = useState("");
  const [moveModal,setMoveModal]   = useState(null);   // flowId to move
  const saveTimer = useRef(null);

  // ── Load persisted state ──
  useEffect(()=>{
    persistLoad().then(data=>{
      if(data){
        if(data.folders) setFolders(data.folders);
        if(data.flows && data.flows.length>0){ setFlows(data.flows); setAFId(data.flows[0].id); }
        if(data.theme) setTheme({...DEFAULT_THEME,...data.theme});
      } else {
        const f = EMPTY_FLOW(); setFlows([f]); setAFId(f.id);
      }
      setReady(true);
    });
  },[]);

  // ── Auto-save on change ──
  useEffect(()=>{
    if(!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>{ persistSave(folders,flows,theme); },800);
  },[folders,flows,theme,ready]);

  const activeFlow = flows.find(f=>f.id===activeFlowId)||flows[0];
  const activeStep = activeFlow?.steps[activeStepIdx];

  // ── Flow helpers ──
  const updateFlow = (id,p)=>setFlows(fs=>fs.map(f=>f.id===id?{...f,...p}:f));
  const updateStep = (fid,si,p)=>setFlows(fs=>fs.map(f=>f.id!==fid?f:{...f,steps:f.steps.map((s,j)=>j!==si?s:{...s,...p})}));
  const updateStepI18n = (fid,si,field,lang,val)=>setFlows(fs=>fs.map(f=>f.id!==fid?f:{...f,steps:f.steps.map((s,j)=>j!==si?s:{...s,[field]:{...s[field],[lang]:val}})}));
  const addFlow  = (folderId=null)=>{ const nf={...EMPTY_FLOW(),folderId}; setFlows(fs=>[...fs,nf]); setAFId(nf.id); setASI(0); };
  const deleteFlow = id=>{ const rem=flows.filter(f=>f.id!==id); setFlows(rem); setAFId(rem[0]?.id||null); };
  const addStep  = fid=>{ const ns=EMPTY_STEP(); setFlows(fs=>fs.map(f=>f.id!==fid?f:{...f,steps:[...f.steps,ns]})); setASI(activeFlow.steps.length); };
  const removeStep= (fid,si)=>{ if(activeFlow.steps.length===1)return; setFlows(fs=>fs.map(f=>f.id!==fid?f:{...f,steps:f.steps.filter((_,j)=>j!==si)})); setASI(Math.max(0,si-1)); };
  const moveStep = (fid,si,d)=>{ const ss=[...activeFlow.steps]; const ni=si+d; if(ni<0||ni>=ss.length)return; [ss[si],ss[ni]]=[ss[ni],ss[si]]; setFlows(fs=>fs.map(f=>f.id!==fid?f:{...f,steps:ss})); setASI(ni); };

  // ── Folder helpers ──
  const addFolder = name=>{ const nf={...EMPTY_FOLDER(),name:name||"Neuer Ordner"}; setFolders(fs=>[...fs,nf]); };
  const deleteFolder = id=>{ setFolders(fs=>fs.filter(f=>f.id!==id)); setFlows(fs=>fs.map(f=>f.folderId===id?{...f,folderId:null}:f)); };
  const updateFolder = (id,p)=>setFolders(fs=>fs.map(f=>f.id===id?{...f,...p}:f));
  const toggleFolder = id=>setFolders(fs=>fs.map(f=>f.id===id?{...f,expanded:!f.expanded}:f));
  const moveFlowToFolder = (flowId,folderId)=>{ updateFlow(flowId,{folderId}); setMoveModal(null); };

  // ── Drag & drop ──
  const onDragStart = (e,flowId)=>{ setDragging(flowId); e.dataTransfer.effectAllowed="move"; };
  const onDragOver  = (e,folderId)=>{ e.preventDefault(); setDragOver(folderId); };
  const onDrop      = (e,folderId)=>{ e.preventDefault(); if(dragging) moveFlowToFolder(dragging,folderId); setDragging(null); setDragOver(null); };
  const onDragEnd   = ()=>{ setDragging(null); setDragOver(null); };

  // ── Export ──
  const configJson = buildConfig(flows,theme);
  const jsonStr    = JSON.stringify(configJson,null,2);
  const gtmSnippet = `<!-- ShopGuide via GTM -->\n<script src="https://cdn.jsdelivr.net/gh/YOUR-ORG/shopguide@1.1/shopguide.min.js"><\/script>\n<script>\nShopGuide.init(${jsonStr});\n<\/script>`;
  const copy = t=>{ navigator.clipboard.writeText(t).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }); };

  // ── Styles ──
  const inp   = {width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid #E5E7EB",fontFamily:"inherit",fontSize:13,color:"#111827",background:"#fff",boxSizing:"border-box"};
  const lbl   = {fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,display:"block"};
  const tabBtn= a=>({padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:a?"#111827":"transparent",color:a?"#fff":"#6B7280",transition:"all .15s"});

  if(!ready) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#6B7280",fontFamily:"sans-serif",fontSize:14}}>Lade gespeicherte Daten…</div>;

  // ── Sidebar tree ──
  const unassigned = flows.filter(f=>!f.folderId);

  function FlowItem({flow}) {
    const active = flow.id===activeFlowId;
    return (
      <div
        draggable
        onDragStart={e=>onDragStart(e,flow.id)}
        onDragEnd={onDragEnd}
        onClick={()=>{ setAFId(flow.id); setASI(0); }}
        style={{
          padding:"8px 10px 8px 12px",borderRadius:8,marginBottom:2,cursor:"pointer",
          background:active?"#EFF6FF":dragging===flow.id?"#F3F4F6":"transparent",
          border:active?`1px solid #BFDBFE`:"1px solid transparent",
          display:"flex",alignItems:"center",gap:6,
          opacity:dragging===flow.id?0.5:1,
        }}
      >
        <span style={{flex:1,fontWeight:600,fontSize:13,color:active?theme.primary:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{flow.id}</span>
        <button onClick={e=>{e.stopPropagation();setMoveModal(flow.id);}} title="In Ordner verschieben"
          style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:13,padding:"2px 4px",borderRadius:4,flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.color="#374151"} onMouseLeave={e=>e.currentTarget.style.color="#9CA3AF"}>
          ⇥
        </button>
      </div>
    );
  }

  function FolderSection({folder}) {
    const folderFlows = flows.filter(f=>f.folderId===folder.id);
    const isOver = dragOver===folder.id;
    return (
      <div
        onDragOver={e=>onDragOver(e,folder.id)}
        onDrop={e=>onDrop(e,folder.id)}
        style={{marginBottom:6}}
      >
        <div style={{
          display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:8,
          background:isOver?"#EFF6FF":"transparent",
          border:isOver?"1px dashed #93C5FD":"1px solid transparent",
          transition:"all .15s",
        }}>
          <button onClick={()=>toggleFolder(folder.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:"#6B7280",fontSize:11,width:16,flexShrink:0}}>
            {folder.expanded?"▾":"▸"}
          </button>
          <span style={{width:8,height:8,borderRadius:"50%",background:folder.color,flexShrink:0,display:"inline-block"}}/>
          <InlineEdit value={folder.name} onSave={v=>updateFolder(folder.id,{name:v})}
            style={{flex:1,fontSize:13,fontWeight:600,color:"#374151"}}/>
          <span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>{folderFlows.length}</span>
          <div style={{display:"flex",gap:2,flexShrink:0}}>
            <button onClick={()=>addFlow(folder.id)} title="Flow hinzufügen"
              style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:13,padding:"2px 4px",borderRadius:4}}
              onMouseEnter={e=>e.currentTarget.style.color="#374151"} onMouseLeave={e=>e.currentTarget.style.color="#9CA3AF"}>+</button>
            <button onClick={()=>deleteFolder(folder.id)} title="Ordner löschen"
              style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,padding:"2px 4px",borderRadius:4}}
              onMouseEnter={e=>e.currentTarget.style.color="#EF4444"} onMouseLeave={e=>e.currentTarget.style.color="#9CA3AF"}>✕</button>
          </div>
        </div>
        {folder.expanded&&(
          <div style={{paddingLeft:20,marginTop:2}}>
            {folderFlows.length===0?(
              <div style={{fontSize:12,color:"#D1D5DB",padding:"6px 10px",border:"1px dashed #E5E7EB",borderRadius:8,textAlign:"center"}}>
                Flow hierher ziehen
              </div>
            ):folderFlows.map(f=><FlowItem key={f.id} flow={f}/>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{fontFamily:"-apple-system,Inter,sans-serif",fontSize:14,color:"#111827",minHeight:"100vh",background:"#F9FAFB"}}>

      {/* ── Header ── */}
      <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"10px 20px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:theme.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontSize:14}}>◎</span>
          </div>
          <span style={{fontWeight:700,fontSize:15}}>ShopGuide</span>
          <span style={{fontSize:11,background:"#F3F4F6",color:"#6B7280",padding:"2px 7px",borderRadius:20}}>Builder v1.2</span>
        </div>
        <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
          {[["builder","⚙ Flows"],["theme","🎨 Theme"],["analytics","📊 Analytics"],["export","📋 Export"]].map(([k,l])=>(
            <button key={k} style={tabBtn(tab===k)} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── BUILDER TAB ── */}
      {tab==="builder"&&(
        <div style={{display:"grid",gridTemplateColumns:"230px 1fr 300px",height:"calc(100vh - 57px)",overflow:"hidden"}}>

          {/* ── Sidebar ── */}
          <div style={{borderRight:"1px solid #E5E7EB",background:"#fff",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"12px 12px 8px",borderBottom:"1px solid #F3F4F6"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.05em"}}>Bibliothek</span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>setShowNF(v=>!v)} title="Ordner erstellen"
                    style={{background:"none",border:"1px solid #E5E7EB",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:12,color:"#6B7280"}}>
                    📁
                  </button>
                  <button onClick={()=>addFlow(null)} title="Flow hinzufügen"
                    style={{background:theme.primary,color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    +
                  </button>
                </div>
              </div>
              {showNewFolder&&(
                <div style={{display:"flex",gap:6,marginBottom:4}}>
                  <input autoFocus value={newFolderName} onChange={e=>setNFName(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&newFolderName.trim()){ addFolder(newFolderName.trim()); setNFName(""); setShowNF(false); } if(e.key==="Escape")setShowNF(false); }}
                    placeholder="Ordnername…"
                    style={{...inp,flex:1,padding:"5px 8px",fontSize:12}}/>
                  <button onClick={()=>{ if(newFolderName.trim()){ addFolder(newFolderName.trim()); setNFName(""); setShowNF(false); } }}
                    style={{background:theme.primary,color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    OK
                  </button>
                </div>
              )}
              {/* Folder colour picker (only shown when folders exist) */}
              {folders.length>0&&(
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                  {folders.map(folder=>(
                    <div key={folder.id} style={{display:"flex",alignItems:"center",gap:4,background:"#F9FAFB",borderRadius:6,padding:"3px 8px",border:"1px solid #E5E7EB"}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:folder.color,display:"inline-block",flexShrink:0}}/>
                      <span style={{fontSize:11,color:"#6B7280",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{folder.name}</span>
                      <div style={{display:"flex",gap:2}}>
                        {FOLDER_COLORS.map(c=>(
                          <div key={c} onClick={()=>updateFolder(folder.id,{color:c})}
                            style={{width:10,height:10,borderRadius:"50%",background:c,cursor:"pointer",border:folder.color===c?"2px solid #111":"2px solid transparent"}}/>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"10px 8px"}}>
              {folders.map(f=><FolderSection key={f.id} folder={f}/>)}
              {unassigned.length>0&&(
                <div onDragOver={e=>onDragOver(e,"__root__")} onDrop={e=>onDrop(e,null)}
                  style={{background:dragOver==="__root__"?"#F0FDF4":"transparent",borderRadius:8,border:dragOver==="__root__"?"1px dashed #86EFAC":"1px solid transparent",transition:"all .15s"}}>
                  {folders.length>0&&<div style={{fontSize:11,color:"#D1D5DB",padding:"4px 10px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>Ohne Ordner</div>}
                  {unassigned.map(f=><FlowItem key={f.id} flow={f}/>)}
                </div>
              )}
            </div>
          </div>

          {/* ── Flow editor ── */}
          <div style={{overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:14}}>
            {!activeFlow?(
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#9CA3AF",fontSize:14}}>
                Wähle einen Flow aus oder erstelle einen neuen.
              </div>
            ):(
              <>
                {/* Flow settings */}
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <span style={{fontWeight:600,fontSize:14}}>Flow-Einstellungen</span>
                    <button onClick={()=>deleteFlow(activeFlow.id)} style={{background:"none",border:"none",color:"#EF4444",fontSize:12,cursor:"pointer"}}>Löschen</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><span style={lbl}>Flow ID</span><input style={inp} value={activeFlow.id} onChange={e=>updateFlow(activeFlow.id,{id:e.target.value})}/></div>
                    <div><span style={lbl}>URL Pattern</span><input style={inp} value={activeFlow.urlPattern} placeholder="/shop*" onChange={e=>updateFlow(activeFlow.id,{urlPattern:e.target.value})}/></div>
                    <div><span style={lbl}>Delay (ms)</span><input style={inp} type="number" value={activeFlow.delay} onChange={e=>updateFlow(activeFlow.id,{delay:Number(e.target.value)})}/></div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,justifyContent:"flex-end"}}>
                      {[["autoStart","Auto-Start"],["once","Nur einmal"]].map(([k,l])=>(
                        <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                          <input type="checkbox" checked={activeFlow[k]} onChange={e=>updateFlow(activeFlow.id,{[k]:e.target.checked})}/>{l}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Language tabs + add step */}
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"#9CA3AF"}}>Bearbeiten:</span>
                  {LANGS.map(l=>(
                    <button key={l} onClick={()=>setELang(l)} style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${editLang===l?theme.primary:"#E5E7EB"}`,background:editLang===l?theme.primary+"15":"transparent",color:editLang===l?theme.primary:"#6B7280",fontSize:12,fontWeight:500,cursor:"pointer"}}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                  <button onClick={()=>addStep(activeFlow.id)} style={{marginLeft:"auto",background:theme.primary,color:"#fff",border:"none",padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer"}}>+ Schritt</button>
                </div>

                {/* Step cards */}
                {activeFlow.steps.map((s,si)=>(
                  <div key={s.id} onClick={()=>setASI(si)} style={{background:"#fff",borderRadius:12,border:`1px solid ${si===activeStepIdx?theme.primary:"#E5E7EB"}`,padding:16,cursor:"pointer",boxShadow:si===activeStepIdx?`0 0 0 3px ${theme.primary}22`:"none",transition:"border .15s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span style={{fontWeight:600,fontSize:13,color:theme.primary}}>Schritt {si+1}</span>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={e=>{e.stopPropagation();moveStep(activeFlow.id,si,-1);}} style={{background:"none",border:"1px solid #E5E7EB",borderRadius:6,padding:"2px 7px",cursor:"pointer",fontSize:11,color:"#6B7280"}}>↑</button>
                        <button onClick={e=>{e.stopPropagation();moveStep(activeFlow.id,si,1);}}  style={{background:"none",border:"1px solid #E5E7EB",borderRadius:6,padding:"2px 7px",cursor:"pointer",fontSize:11,color:"#6B7280"}}>↓</button>
                        <button onClick={e=>{e.stopPropagation();removeStep(activeFlow.id,si);}} disabled={activeFlow.steps.length===1} style={{background:"none",border:"none",color:activeFlow.steps.length===1?"#D1D5DB":"#EF4444",cursor:"pointer",fontSize:13}}>✕</button>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div style={{gridColumn:"1/-1"}}>
                        <span style={lbl}>CSS Selector</span>
                        <input style={inp} value={s.target} placeholder="#element-id" onChange={e=>updateStep(activeFlow.id,si,{target:e.target.value})} onClick={e=>e.stopPropagation()}/>
                      </div>
                      <div>
                        <span style={lbl}>Position</span>
                        <select style={inp} value={s.position} onChange={e=>updateStep(activeFlow.id,si,{position:e.target.value})} onClick={e=>e.stopPropagation()}>
                          {["bottom","top","left","right"].map(p=><option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div style={{display:"flex",alignItems:"flex-end"}}>
                        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                          <input type="checkbox" checked={!!s.button}
                            onChange={e=>updateStep(activeFlow.id,si,{button:e.target.checked?{label:{de:"Mehr erfahren"},url:""}:null})}
                            onClick={e=>e.stopPropagation()}/>
                          Link-Button
                        </label>
                      </div>
                      <div style={{gridColumn:"1/-1"}}>
                        <span style={lbl}>Titel ({editLang.toUpperCase()})</span>
                        <input style={inp} value={s.title?.[editLang]||""} onChange={e=>updateStepI18n(activeFlow.id,si,"title",editLang,e.target.value)} onClick={e=>e.stopPropagation()}/>
                      </div>
                      <div style={{gridColumn:"1/-1"}}>
                        <span style={lbl}>Body ({editLang.toUpperCase()})</span>
                        <textarea style={{...inp,resize:"vertical",minHeight:54}} value={s.body?.[editLang]||""} onChange={e=>updateStepI18n(activeFlow.id,si,"body",editLang,e.target.value)} onClick={e=>e.stopPropagation()}/>
                      </div>
                      {s.button&&(
                        <>
                          <div><span style={lbl}>Button Label ({editLang.toUpperCase()})</span>
                            <input style={inp} value={s.button.label?.[editLang]||""} placeholder="Mehr erfahren"
                              onChange={e=>updateStep(activeFlow.id,si,{button:{...s.button,label:{...s.button.label,[editLang]:e.target.value}}})}
                              onClick={e=>e.stopPropagation()}/></div>
                          <div><span style={lbl}>Button URL</span>
                            <input style={inp} value={s.button.url||""} placeholder="/hilfe"
                              onChange={e=>updateStep(activeFlow.id,si,{button:{...s.button,url:e.target.value}})}
                              onClick={e=>e.stopPropagation()}/></div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Preview ── */}
          <div style={{borderLeft:"1px solid #E5E7EB",background:"#F3F4F6",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"11px 14px 9px",borderBottom:"1px solid #E5E7EB",background:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.05em"}}>Preview</span>
                  {activeFlow&&<div style={{fontSize:11,color:"#9CA3AF"}}>Schritt {activeStepIdx+1}/{activeFlow.steps.length}</div>}
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {LANGS.map(l=>(
                    <button key={l} onClick={()=>setPLang(l)} style={{padding:"2px 6px",borderRadius:5,border:`1px solid ${previewLang===l?theme.primary:"#E5E7EB"}`,background:previewLang===l?theme.primary:"transparent",color:previewLang===l?"#fff":"#9CA3AF",fontSize:10,fontWeight:500,cursor:"pointer"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto",gap:14}}>
              <div style={{background:"rgba(0,0,0,0.5)",borderRadius:12,padding:4,width:"100%",maxWidth:270}}>
                <div style={{background:"#fff",borderRadius:8,padding:"22px 14px",textAlign:"center"}}>
                  <div style={{width:48,height:7,background:"#E5E7EB",borderRadius:4,margin:"0 auto 7px"}}/>
                  <div style={{width:"70%",height:5,background:"#F3F4F6",borderRadius:4,margin:"0 auto 5px"}}/>
                  <div style={{width:"50%",height:5,background:"#F3F4F6",borderRadius:4,margin:"0 auto"}}/>
                </div>
              </div>
              {activeFlow&&activeStep&&(
                <TooltipPreview step={activeStep} stepIdx={activeStepIdx} totalSteps={activeFlow.steps.length} theme={theme} lang={previewLang}/>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── THEME TAB ── */}
      {tab==="theme"&&(
        <div style={{maxWidth:640,margin:"32px auto",padding:"0 20px"}}>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:24}}>
            <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:700}}>Theme anpassen</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {[["primary","Primärfarbe","color"],["primaryText","Button Text","color"],["background","Hintergrund","color"],["text","Textfarbe","color"],["textMuted","Text Muted","color"],["border","Borderfarbe","color"],["borderRadius","Border Radius","text"],["fontFamily","Schriftart","text"],["beaconColor","Beacon Farbe","color"],["beaconPosition","Beacon Position","bpos"],["beaconSize","Beacon Größe (px)","number"]].map(([key,label,type])=>(
                <div key={key}>
                  <span style={lbl}>{label}</span>
                  {type==="color"?(
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input type="color" value={(theme[key]||theme.primary).startsWith("rgba")?"#000":(theme[key]||theme.primary)} onChange={e=>setTheme(t=>({...t,[key]:e.target.value}))} style={{width:36,height:36,borderRadius:6,border:"1px solid #E5E7EB",cursor:"pointer"}}/>
                      <input style={{...inp,flex:1}} value={theme[key]||""} onChange={e=>setTheme(t=>({...t,[key]:e.target.value}))}/>
                    </div>
                  ):type==="bpos"?(
                    <select style={inp} value={theme[key]} onChange={e=>setTheme(t=>({...t,[key]:e.target.value}))}>
                      {["top-right","top-left","bottom-right","bottom-left"].map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  ):type==="number"?(
                    <input style={inp} type="number" min={6} max={20} value={theme[key]} onChange={e=>setTheme(t=>({...t,[key]:Number(e.target.value)}))}/>
                  ):(
                    <input style={inp} value={theme[key]} onChange={e=>setTheme(t=>({...t,[key]:e.target.value}))}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{marginTop:20,padding:16,background:"#F9FAFB",borderRadius:12,border:"1px solid #E5E7EB"}}>
              <span style={lbl}>Beacon Preview</span>
              <div style={{display:"flex",alignItems:"center",gap:20,padding:"12px 0"}}>
                <BeaconPreview color={theme.beaconColor||theme.primary} size={theme.beaconSize}/>
                <span style={{fontSize:12,color:"#6B7280"}}>Pulsierender Marker am Zielelement</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab==="analytics"&&(
        <div style={{maxWidth:620,margin:"32px auto",padding:"0 20px"}}>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:24}}>
            <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:700}}>Analytics — dataLayer Events</h2>
            <p style={{margin:"0 0 16px",fontSize:13,color:"#6B7280",lineHeight:1.6}}>ShopGuide pusht automatisch Events in <code style={{background:"#F3F4F6",padding:"2px 6px",borderRadius:4}}>window.dataLayer</code> (GTM).</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {[["sg_flow_started","sg_flow_id"],["sg_step_viewed","sg_flow_id, sg_step, sg_step_name"],["sg_flow_completed","sg_flow_id"],["sg_flow_dismissed","sg_flow_id, sg_step"],["sg_tooltip_shown","sg_tooltip_id"]].map(([ev,params])=>(
                <div key={ev} style={{background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontFamily:"monospace",fontSize:12,color:"#111827",fontWeight:600}}>{ev}</div>
                  <div style={{fontSize:12,color:"#6B7280",marginTop:3}}>→ {params}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:14}}>
              <p style={{margin:0,fontSize:13,color:"#1E40AF",lineHeight:1.65}}>
                <strong>GTM Setup:</strong> Trigger → Custom Event → Name enthält <code>sg_</code><br/>
                → Tag: GA4 Event → <code>{`{{Event}}`}</code><br/>
                → Parameter: <code>flow_id</code> = <code>{`{{dataLayer.sg_flow_id}}`}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT TAB ── */}
      {tab==="export"&&(
        <div style={{maxWidth:760,margin:"32px auto",padding:"0 20px",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <h2 style={{margin:"0 0 4px",fontSize:16,fontWeight:700}}>GTM Custom HTML Tag</h2>
                <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{flows.length} Flow{flows.length!==1?"s":""} in {folders.length} Ordner{folders.length!==1?"n":""}</p>
              </div>
              <button onClick={()=>copy(gtmSnippet)} style={{background:copied?"#10B981":"#111827",color:"#fff",border:"none",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"}}>{copied?"✓ Kopiert!":"Kopieren"}</button>
            </div>
            <pre style={{background:"#0F172A",color:"#E2E8F0",borderRadius:10,padding:16,fontSize:11.5,overflowX:"auto",lineHeight:1.6,margin:0,maxHeight:380}}>{gtmSnippet}</pre>
          </div>
          <div style={{background:"#EFF6FF",borderRadius:12,border:"1px solid #BFDBFE",padding:14}}>
            <p style={{margin:0,fontSize:13,color:"#1E40AF",lineHeight:1.65}}>
              <strong>Hinweis:</strong> Der Export enthält alle Flows aus allen Ordnern — Ordner sind nur ein Builder-Konzept und haben keinen Einfluss auf das fertige JS. Wenn du nur Flows eines bestimmten Shops exportieren willst, lege pro Shop eine separate Builder-Session an.
            </p>
          </div>
        </div>
      )}

      {/* ── Move Modal ── */}
      {moveModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setMoveModal(null)}>
          <div style={{background:"#fff",borderRadius:16,padding:24,width:320,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700}}>Flow verschieben</h3>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={()=>moveFlowToFolder(moveModal,null)}
                style={{padding:"9px 14px",borderRadius:8,border:"1px solid #E5E7EB",background:"#F9FAFB",cursor:"pointer",textAlign:"left",fontSize:13,color:"#374151",display:"flex",alignItems:"center",gap:8}}>
                <span>📄</span> Ohne Ordner
              </button>
              {folders.map(f=>(
                <button key={f.id} onClick={()=>moveFlowToFolder(moveModal,f.id)}
                  style={{padding:"9px 14px",borderRadius:8,border:"1px solid #E5E7EB",background:"#F9FAFB",cursor:"pointer",textAlign:"left",fontSize:13,color:"#374151",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:f.color,display:"inline-block",flexShrink:0}}/>
                  {f.name}
                </button>
              ))}
              {folders.length===0&&<p style={{fontSize:13,color:"#9CA3AF",margin:0}}>Noch keine Ordner vorhanden. Erstelle zuerst einen Ordner.</p>}
            </div>
            <button onClick={()=>setMoveModal(null)} style={{marginTop:16,width:"100%",padding:"8px",borderRadius:8,border:"1px solid #E5E7EB",background:"transparent",cursor:"pointer",fontSize:13,color:"#6B7280"}}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}
