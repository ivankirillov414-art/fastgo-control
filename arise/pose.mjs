// This module never uploads frames, video, audio or pose landmarks.
export function angle(a,b,c){
  const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],den=Math.hypot(...u)*Math.hypot(...v);
  return den>0?Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/den)))*180/Math.PI:NaN;
}
export function posePhase(track,landmarks){
  if(!landmarks||landmarks.length<29)return 'missing';
  const sides=[[11,13,15,23,25,27],[12,14,16,24,26,28]];
  const side=sides.sort((a,b)=>Math.min(...b.map(i=>landmarks[i]?.visibility||0))-Math.min(...a.map(i=>landmarks[i]?.visibility||0)))[0];
  const [s,e,w,h,k,a]=side.map(i=>landmarks[i]);
  if([s,e,w,h,k,a].some(p=>!p||p.visibility<.7||p.x<0||p.x>1||p.y<0||p.y>1))return 'missing';
  const body=angle(s,h,a),elbow=angle(s,e,w),knee=angle(h,k,a),hip=angle(s,h,k);
  const horizontal=Math.abs(s.y-h.y)<Math.abs(s.x-h.x)*.8;
  if(track==='will')return horizontal&&body>160&&elbow>60&&elbow<125?'hold':'invalid';
  if(track==='strength')return horizontal&&body>155?(elbow>155?'up':elbow<100?'down':'transition'):'invalid';
  if(track==='endurance')return knee>160?'up':knee<105?'down':'transition';
  if(track==='stability')return hip>140?'up':hip<95?'down':'transition';
  return 'invalid';
}
export class PoseCounter{
  constructor(mode){this.mode=mode;this.reps=0;this.validMs=0;this.observations=0;this.phase='wait';this.last=0;this.candidate='';this.since=0;this.downAt=0;}
  update(phase,now){
    const delta=this.last?Math.min(250,Math.max(0,now-this.last)):0;
    this.last=now;
    if(phase==='missing'||phase==='invalid'){this.phase='wait';this.candidate='';this.since=now;return this.snapshot(phase);}
    this.observations++;
    if(this.mode==='hold'){if(phase==='hold'&&this.candidate==='hold')this.validMs+=delta;this.candidate=phase;return this.snapshot(phase);}
    if(phase!==this.candidate){this.candidate=phase;this.since=now;}
    if(now-this.since<150)return this.snapshot(phase);
    if(phase==='up'&&this.phase==='wait')this.phase='ready';
    else if(phase==='down'&&this.phase==='ready'){this.phase='down';this.downAt=now;}
    else if(phase==='up'&&this.phase==='down'&&now-this.downAt>=400){this.reps++;this.phase='ready';}
    return this.snapshot(phase);
  }
  snapshot(phase){return {reps:this.reps,valid_ms:Math.floor(this.validMs),observations:this.observations,phase};}
}
export async function runCamera({video,quest,onUpdate,onError,signal}){
  const {FilesetResolver,PoseLandmarker}=await import('./vendor/pose-sdk.mjs');
  if(signal.aborted)return ()=>{};
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
  const model=await PoseLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},
    runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.7,minPosePresenceConfidence:.7,minTrackingConfidence:.7
  });
  let stream,timer,stopped=false,lastVideo=-1;
  const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;model.close();};
  if(signal.aborted){stop();return ()=>{};}
  signal.addEventListener('abort',stop,{once:true});
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    if(signal.aborted){stream.getTracks().forEach(t=>t.stop());return ()=>{};}
    video.srcObject=stream;await video.play();
    const counter=new PoseCounter(quest.mode);
    const tick=()=>{
      if(stopped||signal.aborted)return;
      try{
        if(document.hidden){counter.update('missing',performance.now());}
        else if(video.readyState>=2&&video.currentTime!==lastVideo){
          lastVideo=video.currentTime;
          const now=performance.now(),result=model.detectForVideo(video,now);
          onUpdate(counter.update(posePhase(quest.track,result.landmarks?.[0]),now));
        }
        timer=setTimeout(tick,100);
      }catch(e){stop();onError(e);}
    };tick();return stop;
  }catch(e){stop();throw e;}
}
