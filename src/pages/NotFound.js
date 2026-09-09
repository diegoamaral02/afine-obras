import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:16,textAlign:"center",padding:24}}>
      <div style={{fontSize:64}}>🏗️</div>
      <h1 style={{fontSize:32,fontWeight:800,color:"var(--afine-black)"}}>404</h1>
      <p style={{fontSize:16,color:"var(--cinza-med)",maxWidth:320}}>Esta página não existe ou você não tem permissão para acessá-la.</p>
      <button className="btn btn-primary" onClick={()=>navigate(-1)}>← Voltar</button>
      <button className="btn" onClick={()=>navigate("/")}>Ir para a Home</button>
    </div>
  );
}
