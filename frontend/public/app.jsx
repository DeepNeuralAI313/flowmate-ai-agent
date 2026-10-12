const { useState, useEffect, useRef } = React;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [dailyPlan, setDailyPlan] = useState(null);
  const [rescuePlan, setRescuePlan] = useState(null);
  const [availableHours, setAvailableHours] = useState(4.0);
  const [messages, setMessages] = useState([
    {
      id: 'm-init',
      sender: 'agent',
      text: "👋 Hi! I'm FlowMate AI, your friendly workday copilot. Tell me what's on your plate today, or click one of the quick starters below to plan your day without stress.",
      toolCalls: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bedrockStatus, setBedrockStatus] = useState({ available: false, provider: 'Connecting...', region: 'us-east-1' });
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskMinutes, setNewTaskMinutes] = useState(30);
  const [newTaskDeadline, setNewTaskDeadline] = useState('Today');
  const [newTaskCategory, setNewTaskCategory] = useState('Client Work');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const chatEndRef = useRef(null);

  // Initialize and load data
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const fetchInitialData = async () => {
    try {
      // 1. Bedrock status
      const bRes = await fetch('/api/bedrock/status');
      if (bRes.ok) {
        const bData = await bRes.json();
        setBedrockStatus(bData);
      }

      // 2. Tasks
      const tRes = await fetch('/api/tasks');
      if (tRes.ok) {
        const tData = await tRes.json();
        if (tData.tasks) setTasks(tData.tasks);
      }

      // 3. Plan
      const pRes = await fetch('/api/plan');
      if (pRes.ok) {
        const pData = await pRes.json();
        setDailyPlan(pData);
      }
    } catch (err) {
      console.warn("API running in local-fallback mode", err);
    }
  };

  const handleSendMessage = async (customText = null) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg = {
      id: 'm-' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          available_hours: availableHours
        })
      });

      if (!res.ok) throw new Error("Agent request failed");
      const data = await res.json();

      const agentMsg = {
        id: 'm-resp-' + Date.now(),
        sender: 'agent',
        text: data.response_text,
        toolCalls: data.tool_calls || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: data.mode
      };

      setMessages(prev => [...prev, agentMsg]);
      if (data.tasks) setTasks(data.tasks);
      if (data.current_plan) setDailyPlan(data.current_plan);
      if (data.rescue_plan) {
        setRescuePlan(data.rescue_plan);
        setActiveTab('rescue');
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'm-err-' + Date.now(),
          sender: 'agent',
          text: "I ran into a temporary communication bump, but don't worry—your tasks are safe! Click 'Retry' or use the quick action buttons below.",
          isError: true,
          retryText: textToSend,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
      } else {
        // Fallback local toggle
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } : t));
      }
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } : t));
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          priority: newTaskPriority,
          estimated_minutes: newTaskMinutes,
          deadline: newTaskDeadline,
          category: newTaskCategory
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(prev => [...prev, data.task]);
        setShowAddTaskModal(false);
        setNewTaskTitle('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const handleBuildPlan = async (hours) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/plan/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_hours: hours || availableHours })
      });
      if (res.ok) {
        const data = await res.json();
        setDailyPlan(data.plan);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerRescue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stress_level: 'high', hours_available: availableHours })
      });
      if (res.ok) {
        const data = await res.json();
        setRescuePlan(data.rescue_plan);
        setActiveTab('rescue');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Computations
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const urgentCount = pendingTasks.filter(t => t.priority === 'URGENT').length;
  const totalMinutes = pendingTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
  const completionPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const nextSuggestedTask = pendingTasks.find(t => t.priority === 'URGENT') || pendingTasks[0];

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'PENDING' && t.status === 'COMPLETED') return false;
    if (filterStatus === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-sm z-20">
        <div>
          {/* Logo & Brand Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 font-bold text-lg">
                ⚡
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-slate-900 leading-none">FlowMate AI</h1>
                <span className="text-[11px] font-semibold text-brand-600 tracking-wide uppercase">Workday Copilot</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'tasks', label: 'My Tasks', icon: '📋', badge: pendingTasks.length },
              { id: 'plan', label: 'Daily Plan', icon: '⏱️' },
              { id: 'chat', label: 'Agent Chat', icon: '💬' },
              { id: 'rescue', label: 'Rescue My Day', icon: '🌿', highlight: true },
              { id: 'settings', label: 'Settings & Cloud', icon: '⚙️' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? item.highlight
                      ? 'bg-rose-50 text-rose-700 font-semibold shadow-sm border border-rose-100'
                      : 'bg-brand-50 text-brand-700 font-semibold shadow-sm border border-brand-100'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">
                    {item.badge}
                  </span>
                )}
                {item.highlight && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer with Bedrock Status Pill */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500">AI Engine</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                bedrockStatus.available ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${bedrockStatus.available ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                {bedrockStatus.available ? 'Bedrock Online' : 'Agent Runtime'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate" title={bedrockStatus.model_id}>
              {bedrockStatus.model_id || 'Claude 3 Haiku'}
            </p>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              {activeTab === 'dashboard' && 'Workday Overview'}
              {activeTab === 'tasks' && 'Task Backlog & Prioritization'}
              {activeTab === 'plan' && 'Time-Blocked Workday Plan'}
              {activeTab === 'chat' && 'Conversational AI Agent'}
              {activeTab === 'rescue' && 'Rescue My Day — Stress Reset'}
              {activeTab === 'settings' && 'System & Cloud Architecture'}
            </h2>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Rescue Button */}
            <button
              onClick={handleTriggerRescue}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition border border-rose-200 shadow-xs"
            >
              <span>🌿</span>
              <span>Rescue My Day</span>
            </button>

            {/* Quick Add Task */}
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition shadow-sm"
            >
              <span>+</span>
              <span>New Task</span>
            </button>
          </div>
        </header>

        {/* Tab View Router */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

          {/* VIEW A: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Friendly Welcome Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 via-teal-700 to-indigo-800 p-8 text-white shadow-md">
                <div className="relative z-10 max-w-2xl space-y-2">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium text-teal-100 mb-2">
                    <span>✨</span>
                    <span>Intelligent Workday Copilot Active</span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Welcome back! Ready for a smooth day?</h3>
                  <p className="text-sm text-teal-100 leading-relaxed">
                    You have <strong className="text-white font-semibold">{pendingTasks.length} tasks</strong> lined up ({totalMinutes} minutes total). Let's protect your focus and keep context-switching to a minimum.
                  </p>
                  <div className="pt-3 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => handleSendMessage("Plan my workday for 4 hours with buffers")}
                      className="px-4 py-2 rounded-xl bg-white text-brand-800 text-xs font-bold shadow-sm hover:bg-teal-50 transition"
                    >
                      Plan My Workday (4h)
                    </button>
                    <button
                      onClick={handleTriggerRescue}
                      className="px-4 py-2 rounded-xl bg-rose-500/90 text-white text-xs font-bold hover:bg-rose-500 transition shadow-sm backdrop-blur"
                    >
                      Feeling Overwhelmed? Rescue Me
                    </button>
                  </div>
                </div>
                {/* Decorative background circle */}
                <div className="absolute right-0 top-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
              </div>

              {/* Top Stats Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Tasks</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-slate-900">{pendingTasks.length}</span>
                    <span className="text-xs text-slate-400 font-medium">{tasks.length} total</span>
                  </div>
                  <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${completionPercentage}%` }}></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Urgent Deliverables</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-rose-600">{urgentCount}</span>
                    <span className="text-xs text-rose-500 font-medium">high priority</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 truncate">Immediate attention today</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Focus Time Needed</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-slate-900">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
                    <span className="text-xs text-teal-600 font-medium">estimated</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Across pending tasks</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Progress Rate</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-emerald-600">{completionPercentage}%</span>
                    <span className="text-xs text-slate-400 font-medium">{completedCount} done</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Keep up the steady pace</p>
                </div>
              </div>

              {/* Two Column Layout: Suggested Next Task & Priority Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Suggested Next Task Spotlight */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🎯</span>
                        <h4 className="font-bold text-slate-900 text-sm">Suggested Next Deep Work Task</h4>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                        AI Recommended
                      </span>
                    </div>

                    {nextSuggestedTask ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              {nextSuggestedTask.category || 'Focus Deliverable'}
                            </span>
                            <h5 className="font-bold text-slate-900 text-base mt-0.5">{nextSuggestedTask.title}</h5>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            nextSuggestedTask.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {nextSuggestedTask.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {nextSuggestedTask.description || 'Focus on completing this deliverable before switching to secondary tasks.'}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                          <span>⏱️ {nextSuggestedTask.estimated_minutes} mins</span>
                          <span>📅 Due: {nextSuggestedTask.deadline || 'Today'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        🎉 All caught up! No pending tasks in queue.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Need to reorganize?</span>
                    <button
                      onClick={() => setActiveTab('chat')}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
                    >
                      <span>Ask FlowMate to re-prioritize</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Quick Interactive Actions */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Quick Workday Starters</h4>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Instant autonomous workflows tailored for independent professionals.
                    </p>
                    <div className="space-y-2.5">
                      <button
                        onClick={() => {
                          setActiveTab('chat');
                          handleSendMessage("I have a client website deadline tomorrow, two invoices to send, a meeting at 3 PM, and four hours to work today.");
                        }}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition text-xs font-medium text-slate-700 flex items-center justify-between"
                      >
                        <span>📝 Natural-language task intake</span>
                        <span className="text-slate-400">⚡</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('chat');
                          handleSendMessage("Plan my workday based on upcoming deadlines");
                        }}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition text-xs font-medium text-slate-700 flex items-center justify-between"
                      >
                        <span>⏱️ Build time-blocked schedule</span>
                        <span className="text-slate-400">⚡</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('chat');
                          handleSendMessage("I'm overwhelmed. I don't know where to start.");
                        }}
                        className="w-full text-left p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/60 transition text-xs font-semibold text-rose-700 flex items-center justify-between"
                      >
                        <span>🌿 Rescue My Day (3-step calm plan)</span>
                        <span className="text-rose-400">⚡</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                    <span className="text-[11px] text-slate-400">All agent actions execute live tools</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW B: MY TASKS */}
          {activeTab === 'tasks' && (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Header with Search/Filters and Add Task */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-500">Filter Status:</span>
                  {['ALL', 'PENDING', 'COMPLETED'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        filterStatus === status
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <button
                    onClick={() => setShowAddTaskModal(true)}
                    className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs whitespace-nowrap"
                  >
                    + Add Task
                  </button>
                </div>
              </div>

              {/* Task Cards List */}
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
                    <p className="text-base font-semibold">No tasks found in this view</p>
                    <p className="text-xs text-slate-400 mt-1">Add a new task or adjust your status filters.</p>
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const isCompleted = task.status === 'COMPLETED';
                    return (
                      <div
                        key={task.id}
                        className={`group bg-white p-4 rounded-2xl border transition-all duration-200 flex items-start justify-between shadow-xs ${
                          isCompleted
                            ? 'border-slate-200/50 bg-slate-50/50 opacity-60'
                            : 'border-slate-200 hover:border-brand-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start space-x-3.5">
                          {/* Complete Checkbox */}
                          <button
                            onClick={() => handleToggleComplete(task)}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              isCompleted
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 hover:border-brand-500 bg-white'
                            }`}
                          >
                            {isCompleted && <span className="text-xs font-bold">✓</span>}
                          </button>

                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className={`text-sm font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                              </h4>
                              <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100">
                                {task.category || 'General'}
                              </span>
                            </div>

                            {task.description && (
                              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center space-x-3 mt-2.5 text-xs text-slate-500">
                              <span className="flex items-center space-x-1">
                                <span>⏱️</span>
                                <span className="font-medium">{task.estimated_minutes}m</span>
                              </span>
                              {task.deadline && (
                                <span className="flex items-center space-x-1">
                                  <span>📅</span>
                                  <span>{task.deadline}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right side priority and delete */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            task.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-700'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-700'
                              : task.priority === 'MEDIUM'
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.priority}
                          </span>

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition"
                            title="Delete Task"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW C: DAILY PLAN */}
          {activeTab === 'plan' && (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Controls bar */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base">Today's Focus Budget</h3>
                  <p className="text-xs text-slate-500">
                    Adjust your available hours; FlowMate will time-block realistic focus slots with built-in breather buffers.
                  </p>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700">{availableHours} hrs</span>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      step="0.5"
                      value={availableHours}
                      onChange={(e) => setAvailableHours(parseFloat(e.target.value))}
                      className="w-32 accent-brand-600 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => handleBuildPlan(availableHours)}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    {isLoading ? 'Re-planning...' : 'Regenerate Plan'}
                  </button>
                </div>
              </div>

              {/* Plan Schedule Timeline */}
              {dailyPlan && dailyPlan.schedule_blocks ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-teal-50 to-indigo-50 p-4 rounded-xl border border-teal-100 flex items-center justify-between text-xs text-slate-700">
                    <span className="font-semibold">{dailyPlan.summary}</span>
                    <span className="font-bold text-brand-700">
                      Buffer: {dailyPlan.buffer_minutes}m reserved
                    </span>
                  </div>

                  <div className="space-y-3">
                    {dailyPlan.schedule_blocks.map((block, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-start space-x-4"
                      >
                        <div className="w-24 shrink-0 text-center py-2 px-1 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-xs font-bold text-brand-700 block">{block.time_slot.split(' - ')[0]}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{block.duration_minutes} mins</span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-700">
                              Block {idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{block.task_title}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {block.focus_objective}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
                  <p className="text-sm font-semibold">No daily plan built yet</p>
                  <button
                    onClick={() => handleBuildPlan(availableHours)}
                    className="mt-3 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold"
                  >
                    Build Plan Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW D: AGENT CHAT */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              
              {/* Chat Messages Log */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-brand-600 text-white rounded-br-none shadow-xs'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                      }`}
                    >
                      {/* Formatted Text */}
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* Tool Execution Badges */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Executed Agent Tools:
                          </span>
                          {msg.toolCalls.map((tc, tidx) => (
                            <div key={tidx} className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono text-slate-700 mr-1.5 mb-1 shadow-2xs">
                              <span className="text-brand-600">🔧</span>
                              <span className="font-semibold">{tc.tool_name}</span>
                              <span className="text-emerald-600 font-bold">✓</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Error & Retry */}
                      {msg.isError && (
                        <div className="mt-2 pt-2 border-t border-rose-200">
                          <button
                            onClick={() => handleSendMessage(msg.retryText)}
                            className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs hover:bg-rose-700 transition"
                          >
                            Retry Request
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping"></span>
                    <span>FlowMate is reasoning and preparing tools...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                {/* Suggested prompt chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    "Plan my workday",
                    "Rescue my day",
                    "Organize client deadlines"
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip)}
                      className="px-2.5 py-1 rounded-full bg-white hover:bg-brand-50 border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-brand-700 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type naturally (e.g. 'I have a website deadline, two invoices, and 4 hours')..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-xs"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* VIEW E: RESCUE MY DAY (DELIGHTFUL EXPERIENCE) */}
          {activeTab === 'rescue' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Calming Reassurance Card */}
              <div className="bg-gradient-to-r from-rose-50 via-teal-50 to-emerald-50 rounded-2xl border border-rose-200/80 p-8 shadow-xs text-center space-y-3">
                <span className="text-4xl animate-float inline-block">🌿</span>
                <h3 className="text-xl font-bold text-slate-900">Rescue My Day</h3>
                <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                  {rescuePlan ? rescuePlan.calm_reassurance : "Take a deep breath. Overwhelm is just having too many open mental tabs. We are parking secondary tasks and focusing strictly on a 3-step calm action plan."}
                </p>
                <div className="pt-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-white border border-rose-200 text-xs font-bold text-rose-700 shadow-xs">
                    3-Step Calm Protocol
                  </span>
                </div>
              </div>

              {/* 3 Step Action Cards */}
              <div className="space-y-4">
                {(rescuePlan ? rescuePlan.actions : [
                  {
                    step_number: 1,
                    what_to_do: "Complete top priority client deliverable",
                    why_it_matters: "Clearing this bottleneck dissolves 80% of immediate workday pressure.",
                    estimated_time: "45 minutes",
                    simple_micro_action: "Open the file now and finish the first 3 lines."
                  },
                  {
                    step_number: 2,
                    what_to_do: "Dispatch quick communication loops",
                    why_it_matters: "Fast check-ins reassure clients and keep contracts moving forward.",
                    estimated_time: "25 minutes",
                    simple_micro_action: "Send the invoice and client reply before stepping away for lunch."
                  },
                  {
                    step_number: 3,
                    what_to_do: "Establish a clear stopping boundary",
                    why_it_matters: "Rest is part of the work. You did enough for one day.",
                    estimated_time: "10 minutes",
                    simple_micro_action: "Write tomorrow's single top item on a note and close your laptop."
                  }
                ]).map((step, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start justify-between gap-4 transition hover:border-brand-300"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                          {step.step_number}
                        </span>
                        <h4 className="font-bold text-slate-900 text-base">{step.what_to_do}</h4>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">
                        <strong className="text-slate-700">Why it matters:</strong> {step.why_it_matters}
                      </p>

                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-2 text-xs text-brand-800">
                        <span className="font-bold text-brand-600">Micro-action:</span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{step.simple_micro_action}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                        ⏱️ {step.estimated_time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Encouragement Footer */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  {rescuePlan ? rescuePlan.encouragement : "You do not need to do everything today. You only need to do Step 1. Start with the micro-action above."}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    Return to Tasks with Fresh Focus
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW F: SETTINGS & BEDROCK CONFIG */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-900 text-base">AWS Cloud & Amazon Bedrock Architecture</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  FlowMate AI utilizes Amazon Bedrock's modern Converse API with autonomous tool specs.
                  When deployed on AWS (Amplify / ECS / Lambda), least-privilege IAM permissions connect directly to Bedrock.
                </p>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Provider Status</span>
                    <span className="font-bold text-slate-800">{bedrockStatus.provider}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">AWS Region</span>
                    <span className="font-mono text-slate-800">{bedrockStatus.region}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Target Bedrock Model</span>
                    <span className="font-mono text-slate-800">{bedrockStatus.model_id || 'anthropic.claude-3-haiku-20240307-v1:0'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">Autonomous Tool Registry</span>
                    <span className="font-bold text-emerald-600">8 Real Agent Tools Registered</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={fetchInitialData}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                  >
                    Refresh Connection Diagnostics
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ADD TASK MODAL */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add New Workday Task</h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Complete invoice review"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={newTaskMinutes}
                    onChange={(e) => setNewTaskMinutes(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Deadline</label>
                  <input
                    type="text"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    placeholder="e.g. Today 5 PM"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    placeholder="e.g. Client Work"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Render React 18 Root
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
