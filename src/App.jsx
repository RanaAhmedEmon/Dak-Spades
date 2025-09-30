import React, { useState, useEffect } from "react";

// Suits and ranks
const SUITS = ["S","H","D","C"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

// Create deck
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

// Card value for AI
function cardValue(card){
  return RANKS.indexOf(card.rank);
}

// AI chooses bid
function aiChooseBid(hand){
  // Always default 5
  return 5;
}

// AI chooses trump
function aiChooseTrump(hand){
  const scores = {};
  SUITS.forEach(s=>scores[s]=0);
  hand.forEach(c=>{
    const val = cardValue(c);
    scores[c.suit] += val>=8?3:val>=5?2:1;
  });
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}

// Legal cards
function legalCards(hand, leadSuit){
  const follow = hand.filter(c=>c.suit===leadSuit);
  return follow.length?follow:hand.slice();
}

// Card image
function getCardImage(card){
  const rankMap = {"A":"ace","K":"king","Q":"queen","J":"jack","10":"10","9":"9","8":"8","7":"7","6":"6","5":"5","4":"4","3":"3","2":"2"};
  const suitMap = {"S":"spades","H":"hearts","D":"diamonds","C":"clubs"};
  return `/assets/${rankMap[card.rank]}_of_${suitMap[card.suit]}.png`;
}

// Back image
const backImg = "/assets/back.png";

export default function App(){
  const [players] = useState(Array.from({length:4},(_,i)=>({id:i,name:i===0?'You':`AI ${i}`,ai:i!==0})));
  const [hands,setHands] = useState({});
  const [phase,setPhase] = useState("lobby");
  const [trump,setTrump] = useState(null);
  const [playerBid,setPlayerBid] = useState(null);
  const [bids,setBids] = useState({});
  const [currentPlayer,setCurrentPlayer] = useState(0);
  const [trick,setTrick] = useState([]);
  const [leadSuit,setLeadSuit] = useState(null);
  const [logs,setLogs] = useState([]);
  const [scores,setScores] = useState({teamA:0, teamB:0});
  const [deck,setDeck] = useState([]);

  const log = t=>setLogs(l=>[t,...l].slice(0,50));

  // Start new round
  function startRound(){
    const newDeck = shuffle(makeDeck());
    setDeck(newDeck);
    const handsLocal = {};
    for(let i=0;i<4;i++){
      handsLocal[i] = newDeck.slice(i*5,i*5+5);
    }
    setHands(handsLocal);
    setPhase("bid5");
    log("5 cards dealt for initial bidding");
  }

  // Player bids 7–13 or pass
  function playerBidCall(val){
    if(val<7) return; // must be >=7
    setPlayerBid(val);
    const bidsLocal = {0: val};
    for(let p=1;p<4;p++){
      bidsLocal[p] = aiChooseBid(hands[p]);
      log(`AI ${p} bids ${bidsLocal[p]}`);
    }
    setBids(bidsLocal);
    // Determine high bidder
    const high = Object.entries(bidsLocal).reduce((best,[pid,v])=>!best||v>best.val?{pid:Number(pid),val:v}:best,null);
    if(high.pid===0){
      setPhase("selectTrump");
      log("You won bid! Select trump suit.");
    } else {
      const chosen = aiChooseTrump(hands[high.pid]);
      setTrump({player:high.pid,bid:high.val,trump:chosen});
      log(`AI ${high.pid} won bid and sets trump ${chosen}`);
      dealRemainingCards();
      setPhase("play");
      setCurrentPlayer(high.pid);
    }
  }

  // Deal remaining 8 cards
  function dealRemainingCards(){
    const handsLocal = {...hands};
    for(let i=0;i<4;i++){
      const currentIds = handsLocal[i].map(c=>c.id);
      handsLocal[i] = [...handsLocal[i], ...deck.filter(c=>!currentIds.includes(c.id)).slice(i*8,i*8+8)];
    }
    setHands(handsLocal);
    log("Remaining 8 cards dealt, full hands ready");
  }

  // Player selects trump
  function selectTrump(suit){
    setTrump({player:0,bid:playerBid,trump:suit});
    log(`You selected trump: ${suit}`);
    dealRemainingCards();
    setPhase("play");
  }

  // Play card
  function playCard(pid,card){
    setHands(prev=>({...prev,[pid]:prev[pid].filter(c=>c.id!==card.id)}));
    setTrick(t=>{
      const newTrick=[...t,{player:pid,card}];
      if(newTrick.length===1) setLeadSuit(card.suit);

      if(newTrick.length===4){
        const trumpSuit = trump.trump;
        let best = newTrick[0];
        newTrick.forEach(p=>{
          if(p.card.suit===trumpSuit && best.card.suit!==trumpSuit) best=p;
          else if(p.card.suit===best.card.suit && cardValue(p.card)>cardValue(best.card)) best=p;
        });

        const team = best.player%2===0?'teamA':'teamB';
        setScores(s=>({...s,[team]:s[team]+1}));

        newTrick.forEach(p=>{
          log(`${p.player===0?'You':'AI '+p.player} played ${p.card.rank} of ${p.card.suit}`);
        });

        setTrick([]);
        setLeadSuit(null);
        setCurrentPlayer(best.player);
      } else setCurrentPlayer((pid+1)%4);

      return newTrick;
    });
  }

  useEffect(()=>{
    if(phase==='play' && players[currentPlayer].ai){
      const legal = legalCards(hands[currentPlayer], leadSuit);
      setTimeout(()=>playCard(currentPlayer, legal[0]),1000);
    }
  },[currentPlayer,phase]);

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-between p-4">
      {/* Lobby */}
      {phase==='lobby' &&
        <button className="bg-emerald-500 px-8 py-4 rounded shadow-lg text-2xl" onClick={startRound}>Start Round</button>
      }

      {/* 5-card Bidding */}
      {phase==='bid5' &&
        <div className="flex flex-col items-center gap-6 mt-6">
          <h2 className="text-white text-3xl font-bold">Bid 7 or above (or Pass)</h2>
          <div className="flex gap-4">
            {[7,8,9,10,11,12,13].map(v=>
              <button key={v} className="bg-blue-500 px-4 py-2 rounded text-white" onClick={()=>playerBidCall(v)}>{v}</button>
            )}
            <button className="bg-gray-500 px-4 py-2 rounded text-white" onClick={()=>playerBidCall(0)}>Pass</button>
          </div>
        </div>
      }

      {/* Trump selection */}
      {phase==='selectTrump' &&
        <div className="flex flex-col items-center gap-4 mt-6">
          <h2 className="text-white text-3xl font-bold">Select Trump</h2>
          <div className="flex gap-4">
            {SUITS.map(s=><button key={s} className="bg-red-500 px-4 py-2 rounded text-white" onClick={()=>selectTrump(s)}>{s}</button>)}
          </div>
        </div>
      }

      {/* Play Phase */}
      {phase==='play' &&
        <div className="relative w-full flex flex-col items-center gap-8">
          <div className="text-white text-2xl font-bold mb-2">Trump: {trump.trump} | Scores - Team A: {scores.teamA} Team B: {scores.teamB}</div>

          {/* Top AI */}
          <div className="flex justify-center gap-4 mt-4">{hands[1]?.map((_,i)=><img key={i} src={backImg} className="w-20 h-28 rounded shadow-lg" alt="AI Card"/>)}</div>

          {/* Trick cards */}
          <div className="relative w-full flex justify-center items-center h-48">
            {trick.map((t,i)=><img key={t.card.id} src={getCardImage(t.card)} className="w-28 h-40 rounded shadow-2xl absolute" style={{transform:`translate(${(i-1.5)*80}px,0)`}} alt={t.card.id}/>)}
          </div>

          {/* Left/Right AI */}
          <div className="flex justify-between w-full px-20 mt-8">
            <div className="flex flex-col gap-2">{hands[3]?.map((_,i)=><img key={i} src={backImg} className="w-20 h-28 rounded shadow-lg" alt="AI Card"/>)}</div>
            <div className="flex flex-col gap-2">{hands[2]?.map((_,i)=><img key={i} src={backImg} className="w-20 h-28 rounded shadow-lg" alt="AI Card"/>)}</div>
          </div>

          {/* Player hand */}
          <div className="flex gap-4 mt-8 justify-center relative">
            {hands[0]?.map((c,i)=>{
              const legal = legalCards(hands[0], leadSuit);
              const isLegal = legal.some(lc=>lc.id===c.id);
              return (
                <img key={c.id} src={getCardImage(c)} className={`w-28 h-40 cursor-pointer transform hover:scale-110 transition-all duration-300 ${isLegal?'':'opacity-40 pointer-events-none'}`} 
                  style={{transform:`rotate(${i*4-24}deg)`}}
                  onClick={()=>isLegal && playCard(0,c)}
                  alt={c.id}/>
              )
            })}
          </div>
        </div>
      }

      {/* Logs */}
      <div className="mt-6 max-h-48 overflow-auto text-white p-4 bg-black/40 w-full rounded shadow-inner">
        <h3 className="font-bold mb-2 text-lg">Logs:</h3>
        {logs.map((l,i)=><div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
