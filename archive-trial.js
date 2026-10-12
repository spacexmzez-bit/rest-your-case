/* File name: archive-trial.js — shared Standard purge and atomic replacement. */
window.RYCArchiveTrial = (() => {
  function describe(state) {
    if (!state?.hasActiveCase) return null;
    const seedTitle=state.activeCaseSeed?.scout?.caseTitle;
    const title=RYCState.placeholder(state.profile?.title)?(RYCState.placeholder(seedTitle)?'Case setup incomplete':seedTitle):state.profile.title;
    const incomplete=RYCState.intakeStatus(state)==='incomplete';
    const failed=!!state._requests?.court;
    const request=state._requests?.court;
    const setupRetry=request&&(request.isInit||/^\/start(?:\s|$)/i.test(String(request.prompt||'').trim()));
    return {title,phase:incomplete?'Intake has not initialized':state.phase||'In progress',action:incomplete?(setupRetry?'Retry setup':'Finish setup'):failed?'Retry action':'Resume trial',incomplete,failed};
  }
  async function purge(expectedRaw, replacement = null) {
    let previous;
    try{previous=JSON.parse(expectedRaw||'null');}catch(_){previous=null;}
    const empty=replacement || {...RYCState.emptyState(previous||{}),_histories:{court:[],partner:[],diaz:[]},_requests:{}};
    await RYCCaseStore.write(expectedRaw,empty,{clearTrialExtras:true});
    return true;
  }
  return {describe,purge};
})();
