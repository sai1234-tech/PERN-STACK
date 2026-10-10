function LeaveBalance({ balance = 0 }) {
  return <section className="panel leave-balance"><span>Leave balance</span><strong>{balance}</strong><small>days remaining</small></section>;
}

export default LeaveBalance;
