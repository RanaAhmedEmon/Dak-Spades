import React, { useState, useEffect } from "react";

// Suits and Ranks
const SUITS = ["S","H","D","C"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

// Make Deck
function makeDeck() {
  const deck = [];
  SUITS.forEach(s => RANKS.forEach(r => deck.push({ suit: s, rank: r, id: `${r}${s}` })));
  return deck;
}

// Shuffle
function shuffle(arr) {
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Card Value for AI
function cardValue(card){
  return RANKS.indexOf(card.rank);
}

// AI choose bid
function aiChooseBid(hand, defaultCall){
  const highCount = hand.filter(c=>["A","K","Q","J","10"].includes(c.rank)).length;
  const spadesCount = hand.filter(c=>c.suit==="S").length;
  let estimate = Math.floor((highCount+spadesCount)/2);
  estimate = Math.max(estimate, defaultCall);
  return Math.min(13, estimate);
}

// AI choose trump
function aiChooseTrump(hand){
  const scores={}; SUITS.forEach(s=>scores[s]=0);
  hand.forEach(c=>{const val=cardValue(c); scores[c.suit]+= val>=8?3: val>=5?2:1;});
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}

// Legal cards to play
function legalCards(hand, leadSuit){
  const follow = hand.filter(c=>c.suit===leadSuit);
  return follow.length?follow:hand.slice();
}

// Map to original image names from repository
function getCardImage(card){
  const rankMap = {
    "A":"ace",
    "K":"king",
    "Q":"queen",
    "J":"jack",
    "10":"10",
    "9":"9",
    "8":"8",
    "7":"7",
    "6":"6",
    "5":"5",
    "4":"4",
    "3":"3",
    "2":"2"
  };
  const suitMap = {
    "S":"spades",
    "H":"hearts",
    "D":"diamonds",
    "C":"clubs"
  };
  // Updated path to public/assets
  return `/assets/${rankMap[card.rank]}_of_${suitMap[card.suit]}.png`;
}

export default function App(){
  const [players] = useState(Array.from({length:4},(_,i)=>({id:i,name:i===0?'You':`AI ${i}`,ai:i!==0})));
  const [hands,setHands] = useState({});
  const [phase,setPhase] = useState("lobby");
  const [bids,setBids] = useState({});
  const [trump,setTrump] = useState(null);
  const [currentPlayer,setCurrentPlayer] = useState(0);
  const [trick,setTrick] = useState([]);
  const [leadSuit,setLeadSuit] = useState(null);
  const [logs,setLogs] = useState([]);
  const [scores,setScores] = useState({teamA:0, teamB:0});

  const log = t=>setLogs(l=>[t,...l].slice(0,50));

  function newRound(){
    const deck = shuffle(makeDeck());
    const handsLocal = {};
    const cardsPerPlayer = 13;
    for(let i=0;i<4;i++) handsLocal[i]=deck.slice(i*cardsPerPlayer,(i+1)*cardsPerPlayer);
    setHands(handsLocal);
    setBids({});
    setTrump(null);
    setPhase("bidding");
    setCurrentPlayer(0);
    setTrick([]);
    setLeadSuit(null);
    log("New round dealt");
  }

  function runBiddingAI(playerBid){
    const bidsLocal={0:playerBid};
    for(let p=1;p<4;p++){
      bidsLocal[p]=aiChooseBid(hands[p],1);
      log(`AI ${p} bids ${bidsLocal[p]}`);
    }
    setBids(bidsLocal);
    const high = Object.entries(bidsLocal).reduce((best,[pid,v])=>!best||v>best.val?{pid:Number(pid),val:v}:best,null);
    if(high && high.val>=1){
      const chosen = high.pid===0?"S":aiChooseTrump(hands[high.pid]);
      setTrump({player:high.pid,bid:high.val,trump:chosen});
      log(`${high.pid===0?'You':'AI '+high.pid} won bidding and sets trump ${chosen}`);
    }
    setPhase("play");
    setCurrentPlayer(high.pid);
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
        newTrick.forEach(play=>{
          if((play.card.suit===best.card.suit && cardValue(play.card)>cardValue(best.card)) || 
             (play.card.suit===trump.trump && best.card.suit!==trump.trump)) best=play;
        });
        const team=best.player%2===0?'teamA':'teamB';
        setScores(s=>({...s,[team]:s[team]+1}));
        setTrick([]);
        setLeadSuit(null);
        setCurrentPlayer(best.player);
      } else setCurrentPlayer((pid+1)%4);
      return newTrick;
    });
  }

  useEffect(()=>{if(phase==='play' && players[currentPlayer].ai) setTimeout(aiPlayTurn,300);},[currentPlayer,phase]);

  return (
    <div className="min-h-screen bg-green-700 p-2 flex flex-col items-center">
      {phase==='lobby' && <button className="bg-emerald-500 px-4 py-2 rounded" onClick={newRound}>Start Round</button>}

      {phase==='bidding' && <div className="text-white mt-4 flex flex-col items-center">
        <div>Your Hand:</div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {hands[0]?.map(c=><img key={c.id} src={getCardImage(c)} className="w-12 h-16 cursor-pointer" onClick={()=>runBiddingAI(3)} alt={`${c.rank} of ${c.suit}`}/>)}
        </div>
        <div className="mt-2">
          <button className="bg-blue-500 px-2 py-1 rounded" onClick={()=>runBiddingAI(3)}>Bid 3</button>
          <button className="bg-blue-500 px-2 py-1 rounded ml-2" onClick={()=>runBiddingAI(5)}>Bid 5</button>
          <button className="bg-blue-500 px-2 py-1 rounded ml-2" onClick={()=>runBiddingAI(7)}>Bid 7</button>
        </div>
      </div>}

      {phase==='play' && <div className="w-full max-w-xl flex flex-col items-center mt-2">
        <div className="text-white mb-2">Trump: {trump.trump} | Scores - Team A: {scores.teamA} Team B: {scores.teamB}</div>
        
        <div className="flex justify-center gap-4 mb-4">
          {trick.map((t,i)=><img key={t.card.id} src={getCardImage(t.card)} className="w-12 h-16" alt={t.card.id}/>)}
        </div>

        {/* AI hands - use updated path */}
        <div className="flex justify-center gap-1 mb-2">{hands[1]?.map((c,i)=><img key={i} src="/assets/back.png" className="w-10 h-14" alt="back"/>)}</div>

        <div className="flex justify-between w-full">
          <div className="flex gap-1">{hands[3]?.map((c,i)=><img key={i} src="/assets/back.png" className="w-10 h-14" alt="back"/>)}</div>
          <div className="flex gap-1">{hands[2]?.map((c,i)=><img key={i} src="/assets/back.png" className="w-10 h-14" alt="back"/>)}</div>
        </div>

        <div className="flex gap-1 mt-4">{hands[0]?.map(c=><img key={c.id} src={getCardImage(c)} className="w-12 h-16 cursor-pointer" onClick={()=>playCard(0,c)} alt={c.id}/>)}</div>
      </div>}

      <div className="mt-4 max-h-36 overflow-auto text-sm text-white p-2 bg-black/40 w-full max-w-xl rounded">
        Logs:<br/>{logs.map((l,i)=><div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
