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

// Card image paths
function getCardImage(card){
  const rankMap = {
    "A":"ace","K":"king","Q":"queen","J":"jack",
    "10":"10","9":"9","8":"8","7":"7","6":"6",
    "5":"5","4":"4","3":"3","2":"2"
  };
  const suitMap = {
    "S":"spades","H":"hearts","D":"diamonds","C":"clubs"
  };
  return `/assets/${rankMap[card.rank]}_of_${suitMap[card.suit]}.png`;
}

// Back image
const backImg = "/assets/back.png";

export default function App() {
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
  const [fiveCardsDealt,setFiveCardsDealt] = useState(false);

  const log = t=>setLogs(l=>[t,...l].slice(0,50));

  // Deal initial 5 cards first for bidding
  function dealFiveCards() {
    const deck = shuffle(makeDeck());
    const handsLocal = {};
    for(let i=0;i<4;i++){
      handsLocal[i] = deck.slice(i*5,(i+1)*5);
    }
    setHands(handsLocal);
    setPhase("bidding");
    setCurrentPlayer(0);
    setFiveCardsDealt(true);
    log("5 cards dealt to all players for bidding");
  }

  // After bidding, deal remaining 8 cards to each player
  function dealRemainingCards() {
    const deck = shuffle(makeDeck());
    const handsLocal = {...hands};
    for(let i=0;i<4;i++){
      const currentIds = handsLocal[i].map(c=>c.id);
      handsLocal[i] = [...handsLocal[i], ...deck.filter(c=>!currentIds.includes(c.id)).slice(i*8,(i+1)*8)];
    }
    setHands(handsLocal);
    log("Remaining 8 cards dealt, full hands ready");
  }

  // Run bidding
  function runBidding(defaultCall=5){
    const bidsLocal={0:defaultCall};
    for(let p=1;p<4;p++){
      bidsLocal[p]=aiChooseBid(hands[p], defaultCall);
      log(`AI ${p} bids ${bidsLocal[p]}`);
    }
    setBids(bidsLocal);
    const high = Object.entries(bidsLocal).reduce((best,[pid,v])=>!best||v>best.val?{pid:Number(pid),val:v}:best,null);
    if(high && high.val>=defaultCall){
      const chosen = high.pid===0 ? "S" : aiChooseTrump(hands[high.pid]);
      setTrump({player:high.pid,bid:high.val,trump:chosen});
      log(`${high.pid===0?'You':'AI '+high.pid} won bidding and sets trump ${chosen}`);
    }
    dealRemainingCards();
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

  useEffect(()=>{
    if(phase==='play' && players[currentPlayer].ai) setTimeout(aiPlayTurn,800);
  },[currentPlayer,phase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-600 p-4 flex flex-col items-center">
      
      {/* Lobby / Start */}
      {phase==='lobby' && <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded shadow-lg text-xl" onClick={dealFiveCards}>Start Round</button>}

      {/* Bidding Phase */}
      {phase==='bidding' && fiveCardsDealt && <div className="w-full max-w-6xl flex flex-col items-center mt-4 gap-6">
        <h2 className="text-white text-2xl font-bold mb-2">Bidding Phase</h2>

        <div className="flex flex-col gap-6 w-full justify-center items-center">
          {/* AI Hands */}
          <div className="flex gap-2 justify-center">
            {hands[1]?.map((_,i)=><img key={i} src={backImg} className="w-16 h-24 rounded shadow-lg" alt="AI Card"/>)}
          </div>

          {/* Player Hand */}
          <div className="flex flex-wrap gap-4 justify-center mt-4">
            {hands[0]?.map(c=>
              <img key={c.id} src={getCardImage(c)} className="w-20 h-28 cursor-pointer transform hover:scale-110 transition" alt={c.id}/>
            )}
          </div>

          {/* Bid Buttons */}
          <div className="mt-4 flex gap-4">
            <button className="bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded text-white font-bold" onClick={()=>runBidding(5)}>Bid 5</button>
            <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white font-bold" onClick={()=>runBidding(7)}>Bid 7</button>
          </div>

          {/* AI Bids */}
          <div className="text-white mt-4">
            {Object.entries(bids).map(([pid,v])=>(
              <div key={pid}>{pid==0?'You':`AI ${pid}`} bid: {v}</div>
            ))}
          </div>
        </div>
      </div>}

      {/* Play Phase */}
      {phase==='play' && <div className="w-full max-w-7xl flex flex-col items-center mt-6 gap-6">

        <div className="text-white text-xl font-bold mb-2">Trump: {trump.trump} | Scores - Team A: {scores.teamA} Team B: {scores.teamB}</div>

        {/* Top AI (player 1) */}
        <div className="flex gap-4 justify-center">
          {hands[1]?.map((_,i)=><img key={i} src={backImg} className="w-16 h-24 rounded shadow-lg" alt="AI Card"/>)}
        </div>

        {/* Middle Play Table */}
        <div className="flex justify-center gap-8 mt-4">
          {trick.map(t=>
            <img key={t.card.id} src={getCardImage(t.card)} className="w-24 h-36 rounded shadow-xl" alt={t.card.id}/>
          )}
        </div>

        {/* Bottom AI (player 2 & 3) */}
        <div className="flex justify-between w-full px-16 mt-6">
          <div className="flex gap-4">{hands[3]?.map((_,i)=><img key={i} src={backImg} className="w-16 h-24 rounded shadow-lg" alt="AI Card"/>)}</div>
          <div className="flex gap-4">{hands[2]?.map((_,i)=><img key={i} src={backImg} className="w-16 h-24 rounded shadow-lg" alt="AI Card"/>)}</div>
        </div>

        {/* Player Hand */}
        <div className="flex gap-4 mt-6 flex-wrap justify-center">
          {hands[0]?.map(c=>
            <img key={c.id} src={getCardImage(c)} className="w-24 h-36 cursor-pointer transform hover:scale-110 transition" onClick={()=>playCard(0,c)} alt={c.id}/>
          )}
        </div>
      </div>}

      {/* Logs */}
      <div className="mt-6 max-h-40 overflow-auto text-white p-4 bg-black/40 w-full max-w-7xl rounded shadow-inner">
        <h3 className="font-bold mb-2">Logs:</h3>
        {logs.map((l,i)=><div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
