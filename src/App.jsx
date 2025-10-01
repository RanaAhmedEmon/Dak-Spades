import React, { useState, useEffect } from "react";

const SUITS = ["S","H","D","C"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function makeDeck() {
  const deck = [];
  SUITS.forEach(s => RANKS.forEach(r => deck.push({ suit: s, rank: r, id: `${r}${s}` })));
  return deck;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function cardValue(card){ return RANKS.indexOf(card.rank); }
function legalCards(hand, leadSuit){
  const follow = hand.filter(c=>c.suit===leadSuit);
  return follow.length?follow:hand;
}

function getCardImage(card){
  const rankMap = {"A":"ace","K":"king","Q":"queen","J":"jack","10":"10","9":"9","8":"8","7":"7","6":"6","5":"5","4":"4","3":"3","2":"2"};
  const suitMap = {"S":"spades","H":"hearts","D":"diamonds","C":"clubs"};
  return `/assets/${rankMap[card.rank]}_of_${suitMap[card.suit]}.png`;
}

export default function App(){
  const [deck,setDeck] = useState([]);
  const [hands,setHands] = useState({});
  const [phase,setPhase] = useState("lobby");
  const [bids,setBids] = useState({});
  const [playerBid,setPlayerBid] = useState(null);
  const [trump,setTrump] = useState(null);
  const [currentPlayer,setCurrentPlayer] = useState(0);
  const [trick,setTrick] = useState([]);
  const [leadSuit,setLeadSuit] = useState(null);
  const [logs,setLogs] = useState([]);
  const [scores,setScores] = useState({teamA:0, teamB:0});

  const log = t=>setLogs(l=>[t,...l].slice(0,30));

  function startRound(){
    const newDeck = shuffle(makeDeck());
    setDeck(newDeck);
    const handsLocal={};
    for(let i=0;i<4;i++){
      handsLocal[i]=newDeck.slice(i*5,i*5+5);
    }
    setHands(handsLocal);
    setPhase("bidding");
    log("5 cards dealt for bidding.");
  }

  function runBids(val){
    if(val!==0 && val<7) return;
    const bidsLocal={0:val};
    for(let p=1;p<4;p++){ bidsLocal[p]=5; log(`AI ${p} bids 5`); }
    setBids(bidsLocal);

    const high = Object.entries(bidsLocal).reduce((best,[pid,v])=>!best||v>best.val?{pid:+pid,val:v}:best,null);

    if(high.pid===0 && val>=7){
      setPhase("selectTrump");
      setPlayerBid(val);
    } else if(high.val>=7) {
      const chosen = ["S","H","D","C"][Math.floor(Math.random()*4)];
      setTrump({player:high.pid,bid:high.val,trump:chosen});
      log(`AI ${high.pid} wins bid ${high.val} and selects trump ${chosen}`);
      dealRemaining(newDeck,handsLocal);
      setCurrentPlayer(high.pid);
      setPhase("play");
    } else {
      log("Nobody bid 7+, redeal needed!");
      setPhase("lobby");
    }
  }

  function selectTrump(suit){
    setTrump({player:0,bid:playerBid,trump:suit});
    log(`You select trump: ${suit}`);
    dealRemaining(deck,hands);
    setCurrentPlayer(0);
    setPhase("play");
  }

  function dealRemaining(deck,handsLocal){
    const updated={...handsLocal};
    for(let i=0;i<4;i++){
      updated[i]=deck.slice(i*13,i*13+13);
    }
    setHands(updated);
    log("Remaining cards dealt, full hands ready.");
  }

  function playCard(pid,card){
    setHands(prev=>({...prev,[pid]:prev[pid].filter(c=>c.id!==card.id)}));
    setTrick(t=>{
      const newTrick=[...t,{player:pid,card}];
      if(newTrick.length===1) setLeadSuit(card.suit);

      if(newTrick.length===4){
        const trumpSuit = trump.trump;
        let best=newTrick[0];
        newTrick.forEach(p=>{
          if(p.card.suit===trumpSuit && best.card.suit!==trumpSuit) best=p;
          else if(p.card.suit===best.card.suit && cardValue(p.card)>cardValue(best.card)) best=p;
        });
        const team=best.player%2===0?'teamA':'teamB';
        setScores(s=>({...s,[team]:s[team]+1}));
        log(`Trick won by ${best.player===0?"You":`AI ${best.player}`}`);

        setTrick([]);
        setLeadSuit(null);
        setCurrentPlayer(best.player);
      } else {
        setCurrentPlayer((pid+1)%4);
      }
      return newTrick;
    });
  }

  useEffect(()=>{
    if(phase==="play" && currentPlayer!==0){
      const legal=legalCards(hands[currentPlayer],leadSuit);
      setTimeout(()=>playCard(currentPlayer,legal[0]),1000);
    }
  },[currentPlayer,phase]);

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-between p-4">
      {/* Lobby */}
      {phase==="lobby" && <button className="bg-emerald-500 px-8 py-4 rounded text-2xl" onClick={startRound}>Start Round</button>}

      {/* Bidding */}
      {phase==="bidding" &&
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-white text-3xl">Bid 7+ or Pass</h2>
          <div className="flex gap-4">
            {[7,8,9,10,11,12,13].map(v=>
              <button key={v} onClick={()=>runBids(v)} className="bg-blue-500 px-4 py-2 text-white rounded">{v}</button>
            )}
            <button onClick={()=>runBids(0)} className="bg-gray-500 px-4 py-2 text-white rounded">Pass</button>
          </div>
        </div>
      }

      {/* Trump Selection */}
      {phase==="selectTrump" &&
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-white text-3xl">Select Trump</h2>
          <div className="flex gap-4">
            {SUITS.map(s=>
              <button key={s} onClick={()=>selectTrump(s)} className="bg-red-500 px-4 py-2 text-white rounded">{s}</button>
            )}
          </div>
        </div>
      }

      {/* Play Phase */}
      {phase==="play" &&
        <div className="flex flex-col items-center gap-8">
          <div className="text-white text-xl font-bold">Trump: {trump.trump} | Scores: A {scores.teamA} - B {scores.teamB}</div>
          {/* Trick cards */}
          <div className="flex justify-center gap-6 h-48">
            {trick.map((t,i)=>
              <img key={t.card.id} src={getCardImage(t.card)} className="w-28 h-40 rounded shadow-2xl" alt={t.card.id}/>
            )}
          </div>
          {/* Player Hand */}
          <div className="flex gap-4 mt-8 flex-wrap justify-center">
            {hands[0]?.map(c=>{
              const legal=legalCards(hands[0],leadSuit);
              const isLegal=legal.some(lc=>lc.id===c.id);
              return (
                <img key={c.id} src={getCardImage(c)} className={`w-20 h-32 cursor-pointer ${isLegal?"hover:scale-110":"opacity-40 pointer-events-none"} transition`} 
                  onClick={()=>isLegal && playCard(0,c)} alt={c.id}/>
              )
            })}
          </div>
        </div>
      }

      {/* Logs */}
      <div className="mt-6 max-h-40 overflow-auto text-white bg-black/40 p-2 rounded w-full">
        {logs.map((l,i)=><div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
