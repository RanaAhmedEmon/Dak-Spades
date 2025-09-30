import React, { useState, useEffect } from "react";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function makeDeck() {
  const deck = [];
  SUITS.forEach(s => RANKS.forEach(r => deck.push({ suit: s, rank: r, id: `${s}-${r}` })));
  return deck;
}

function shuffle(arr) {
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(card){
  return RANKS.indexOf(card.rank);
}

function higherCard(a,b,leadSuit,trump){
  if(a.suit===b.suit) return cardValue(a) > cardValue(b);
  if(a.suit===trump && b.suit!==trump) return true;
  if(b.suit===trump && a.suit!==trump) return false;
  if(a.suit===leadSuit && b.suit!==leadSuit) return true;
  return false;
}

function aiChooseBid(hand,difficulty,defaultCall){
  const highCount = hand.filter(c=>["A","K","Q","J","10"].includes(c.rank)).length;
  const spadesCount = hand.filter(c=>c.suit==="♠").length;
  let estimate = Math.floor((highCount+spadesCount)/2);
  if(difficulty==="Easy") estimate=Math.max(1,estimate-1+Math.floor(Math.random()*2));
  if(difficulty==="Hard") estimate=Math.max(1,estimate+(Math.random()<0.4?1:0));
  estimate = Math.min(13,estimate);
  return Math.max(estimate,defaultCall);
}

function aiChooseTrump(hand){
  const scores={}; SUITS.forEach(s=>scores[s]=0);
  hand.forEach(c=>{const val=cardValue(c); scores[c.suit]+= val>=8?3: val>=5?2:1; });
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}

function legalCards(hand, leadSuit){
  const follow = hand.filter(c=>c.suit===leadSuit);
  return follow.length?follow:hand.slice();
}

export default function DakSpadesApp(){
  const [defaultCallTeamA,setDefaultCallTeamA]=useState(7);
  const [defaultCallTeamB,setDefaultCallTeamB]=useState(5);
  const [players] = useState(Array.from({length:4},(_,i)=>({id:i,name:`P${i+1}`,ai:true})));
  const [difficulty,setDifficulty] = useState("Extreme");
  const [hands,setHands] = useState({});
  const [bids,setBids] = useState({});
  const [trump,setTrump] = useState(null);
  const [phase,setPhase] = useState("lobby");
  const [currentPlayer,setCurrentPlayer] = useState(0);
  const [trick,setTrick] = useState([]);
  const [leadSuit,setLeadSuit] = useState(null);
  const [scores,setScores] = useState({teamA:0,teamB:0});
  const [logs,setLogs] = useState([]);

  const log = t=>setLogs(l=>[t,...l].slice(0,50));

  function newRound(){
    const deck = shuffle(makeDeck());
    const handsLocal = {};
    const cardsPerPlayer = 13;
    for(let i=0;i<4;i++) handsLocal[i]=deck.slice(i*cardsPerPlayer,(i+1)*cardsPerPlayer);
    setHands(handsLocal); setBids({}); setTrump(null); setPhase("bidding"); setCurrentPlayer(0); setTrick([]); setLeadSuit(null);
    log("New round: dealt hands");
  }

  function runBiddingAI(){
    const bidsLocal={};
    const defaults = p => p%2===0?defaultCallTeamA:defaultCallTeamB;
    for(let p=0;p<4;p++){
      bidsLocal[p]=aiChooseBid(hands[p],difficulty,defaults(p));
      log(`AI P${p+1} bids ${bidsLocal[p]}`);
    }
    setBids(bidsLocal);
    const high = Object.entries(bidsLocal).reduce((best,[pid,v])=>!best||v>best.val?{pid:Number(pid),val:v}:best,null);
    if(high && high.val>=Math.max(defaultCallTeamA,defaultCallTeamB)){
      const chosen = aiChooseTrump(hands[high.pid]);
      setTrump({player:high.pid,bid:high.val,trump:chosen});
      log(`Player ${high.pid+1} won bidding with ${high.val} and sets trump ${chosen}`);
    } else {
      setTrump({trump:"♠"});
      log(`Default trump ♠`);
    }
    setPhase("play"); setCurrentPlayer(0);
  }

  function aiPlayTurn(){
    const hand = hands[currentPlayer];
    const card = legalCards(hand,leadSuit)[0];
    playCard(currentPlayer,card);
  }

  function playCard(pid,card){
    setHands(prev=>({...prev,[pid]:prev[pid].filter(c=>c.id!==card.id)}));
    setTrick(t=>{
      const newTrick=[...t,{player:pid,card}];
      if(newTrick.length===1) setLeadSuit(card.suit);
      if(newTrick.length===4){
        const lead = newTrick[0].card;
        let best=newTrick[0];
        newTrick.forEach(play=>{if(higherCard(play.card,best.card,lead.suit,trump.trump)) best=play;});
        const team=best.player%2===0?'teamA':'teamB';
        setScores(s=>({...s,[team]:s[team]+1}));
        setTrick([]); setLeadSuit(null); setCurrentPlayer(best.player);
      } else setCurrentPlayer((pid+1)%4);
      return newTrick;
    });
  }

  useEffect(()=>{if(phase==='bidding') runBiddingAI();},[phase]);
  useEffect(()=>{if(phase==='play' && players[currentPlayer].ai) setTimeout(aiPlayTurn,300);},[currentPlayer,phase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-xl mx-auto bg-slate-900/60 rounded-2xl p-4 shadow-lg">
        {phase==='lobby' && <button className="bg-emerald-500 px-4 py-2 rounded" onClick={newRound}>Start 4-Player Round</button>}
        {phase==='bidding' && <div>Bidding phase... see logs below</div>}
        {phase==='play' && <div>
          <div>Trump: {trump.trump} | Scores — Team A: {scores.teamA} Team B: {scores.teamB}</div>
          <div className="flex gap-2 mt-2">{trick.map((t,i)=><div key={i}>{t.card.rank}{t.card.suit} P{t.player+1}</div>)}</div>
          <div className="mt-2">Your hand:</div>
          <div className="flex gap-2 overflow-x-auto py-2">{(hands[0]||[]).map(c=><div key={c.id} onClick={()=>playCard(0,c)} className="cursor-pointer border p-1 rounded">{c.rank}{c.suit}</div>)}</div>
        </div>}
        <div className="mt-4 max-h-36 overflow-auto text-sm bg-slate-900/40 p-2 rounded">Logs:<br/>{logs.map((l,i)=><div key={i}>{l}</div>)}</div>
      </div>
    </div>
  );
}
