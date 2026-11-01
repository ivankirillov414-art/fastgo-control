// Older supported Android WebViews dispatch submit without SubmitEvent.submitter.
// These forms have one primary submit control; preserve the real control when
// newer browsers provide it and otherwise find the form's submit button.
export function submitControl(event){
 return event.submitter||(event.currentTarget||event.target)?.querySelector('button[type="submit"],input[type="submit"],button:not([type])');
}
