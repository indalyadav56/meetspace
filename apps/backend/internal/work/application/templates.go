package application

import "github.com/indalyadav56/meetspace/backend/internal/work/domain"

type templateTask struct {
	Title    string
	Status   domain.StatusType
	Priority *string
	Tags     []string
	Due      *int // days from today
	Subtasks []string
}

type listTemplate struct {
	Name  string
	Tasks []templateTask
}

func p(s string) *string { return &s }
func d(n int) *int       { return &n }

// templates are the built-in List templates offered by the "From template" picker.
var templates = map[string]listTemplate{
	"sprint": {Name: "Sprint", Tasks: []templateTask{
		{Title: "Sprint planning", Status: domain.StatusDone, Due: d(0), Tags: []string{"ritual"}},
		{Title: "Groom top 10 backlog items", Status: domain.StatusActive, Due: d(1), Priority: p("high")},
		{Title: "Implement highest-priority story", Status: domain.StatusOpen, Due: d(6), Priority: p("high"), Subtasks: []string{"Write tests", "Code review", "Deploy to staging"}},
		{Title: "Fix regressions from last release", Status: domain.StatusOpen, Due: d(4), Priority: p("urgent"), Tags: []string{"bug"}},
		{Title: "Sprint demo", Status: domain.StatusOpen, Due: d(13), Tags: []string{"ritual"}},
		{Title: "Retrospective", Status: domain.StatusOpen, Due: d(13), Tags: []string{"ritual"}},
	}},
	"bugs": {Name: "Bug tracker", Tasks: []templateTask{
		{Title: "Triage new reports", Status: domain.StatusActive, Priority: p("high"), Due: d(0), Tags: []string{"triage"}},
		{Title: "Login button unresponsive on slow networks", Status: domain.StatusOpen, Priority: p("urgent"), Due: d(1), Tags: []string{"bug"}},
		{Title: "Export CSV misses custom fields", Status: domain.StatusOpen, Priority: p("normal"), Due: d(5), Tags: []string{"bug"}},
		{Title: "Typo in onboarding email", Status: domain.StatusDone, Priority: p("low"), Tags: []string{"bug"}},
	}},
	"content": {Name: "Content calendar", Tasks: []templateTask{
		{Title: "Brainstorm next month’s topics", Status: domain.StatusOpen, Due: d(2)},
		{Title: "Draft: customer story", Status: domain.StatusActive, Due: d(5), Tags: []string{"blog"}},
		{Title: "Design social graphics", Status: domain.StatusOpen, Due: d(6), Tags: []string{"social"}},
		{Title: "Schedule newsletter", Status: domain.StatusOpen, Due: d(9), Tags: []string{"email"}},
	}},
	"hiring": {Name: "Hiring pipeline", Tasks: []templateTask{
		{Title: "Write job description", Status: domain.StatusDone},
		{Title: "Source 20 candidates", Status: domain.StatusActive, Due: d(7)},
		{Title: "Phone screens", Status: domain.StatusOpen, Due: d(10), Subtasks: []string{"Candidate A", "Candidate B", "Candidate C"}},
		{Title: "Onsite interviews", Status: domain.StatusOpen, Due: d(17)},
		{Title: "Make offer", Status: domain.StatusOpen, Due: d(21), Priority: p("high")},
	}},
	"launch": {Name: "Product launch", Tasks: []templateTask{
		{Title: "Positioning & messaging", Status: domain.StatusActive, Due: d(3), Priority: p("high")},
		{Title: "Landing page", Status: domain.StatusOpen, Due: d(8)},
		{Title: "Press kit", Status: domain.StatusOpen, Due: d(10)},
		{Title: "Launch-day checklist", Status: domain.StatusOpen, Due: d(14), Priority: p("urgent"), Subtasks: []string{"Enable feature flags", "Publish blog post", "Post on social"}},
	}},
	"crm": {Name: "Sales pipeline", Tasks: []templateTask{
		{Title: "Qualify inbound lead: Northwind", Status: domain.StatusActive, Priority: p("high"), Due: d(1), Tags: []string{"lead"}},
		{Title: "Discovery call: Bluepeak", Status: domain.StatusOpen, Priority: p("normal"), Due: d(3), Tags: []string{"discovery"}, Subtasks: []string{"Send agenda", "Share pricing deck"}},
		{Title: "Send proposal: Lumen & Co", Status: domain.StatusOpen, Priority: p("high"), Due: d(5), Tags: []string{"proposal"}},
		{Title: "Negotiate renewal: Fernway", Status: domain.StatusOpen, Priority: p("normal"), Due: d(9), Tags: []string{"renewal"}},
		{Title: "Closed won: Quarry pilot", Status: domain.StatusDone, Tags: []string{"won"}},
	}},
	"support": {Name: "Customer support", Tasks: []templateTask{
		{Title: "Reply to unanswered tickets", Status: domain.StatusActive, Priority: p("urgent"), Due: d(0), Tags: []string{"inbox"}},
		{Title: "Can’t reset password on mobile", Status: domain.StatusOpen, Priority: p("high"), Due: d(1), Tags: []string{"ticket"}},
		{Title: "Billing question: annual plan refund", Status: domain.StatusOpen, Priority: p("normal"), Due: d(2), Tags: []string{"ticket", "billing"}},
		{Title: "Update help-center article on invites", Status: domain.StatusOpen, Priority: p("low"), Due: d(6), Tags: []string{"docs"}},
		{Title: "Weekly feedback round-up", Status: domain.StatusOpen, Priority: p("normal"), Due: d(4), Tags: []string{"feedback"}},
	}},
	"roadmap": {Name: "Project roadmap", Tasks: []templateTask{
		{Title: "Kickoff and goals", Status: domain.StatusDone, Tags: []string{"milestone"}},
		{Title: "Requirements and scope", Status: domain.StatusActive, Priority: p("high"), Due: d(4), Tags: []string{"milestone"}, Subtasks: []string{"Interview stakeholders", "Write spec", "Sign-off"}},
		{Title: "Design", Status: domain.StatusOpen, Priority: p("normal"), Due: d(14), Tags: []string{"milestone"}},
		{Title: "Build", Status: domain.StatusOpen, Priority: p("high"), Due: d(35), Tags: []string{"milestone"}},
		{Title: "Launch and review", Status: domain.StatusOpen, Priority: p("normal"), Due: d(49), Tags: []string{"milestone"}},
	}},
	"marketing": {Name: "Marketing campaign", Tasks: []templateTask{
		{Title: "Define audience and message", Status: domain.StatusActive, Priority: p("high"), Due: d(2), Tags: []string{"strategy"}},
		{Title: "Landing page copy", Status: domain.StatusOpen, Priority: p("normal"), Due: d(6), Tags: []string{"web"}},
		{Title: "Email sequence (3 emails)", Status: domain.StatusOpen, Priority: p("normal"), Due: d(8), Tags: []string{"email"}, Subtasks: []string{"Email 1: announce", "Email 2: story", "Email 3: last call"}},
		{Title: "Paid social ads", Status: domain.StatusOpen, Priority: p("normal"), Due: d(10), Tags: []string{"ads"}},
		{Title: "Campaign results report", Status: domain.StatusOpen, Priority: p("low"), Due: d(24), Tags: []string{"report"}},
	}},
	"events": {Name: "Event planning", Tasks: []templateTask{
		{Title: "Pick date and budget", Status: domain.StatusDone, Tags: []string{"planning"}},
		{Title: "Book venue", Status: domain.StatusActive, Priority: p("high"), Due: d(5), Tags: []string{"venue"}},
		{Title: "Speaker and agenda", Status: domain.StatusOpen, Priority: p("normal"), Due: d(12), Tags: []string{"content"}, Subtasks: []string{"Confirm speakers", "Publish agenda"}},
		{Title: "Send invitations", Status: domain.StatusOpen, Priority: p("high"), Due: d(15), Tags: []string{"invites"}},
		{Title: "Post-event survey", Status: domain.StatusOpen, Priority: p("low"), Due: d(32), Tags: []string{"follow-up"}},
	}},
	"personal": {Name: "Personal to-dos", Tasks: []templateTask{
		{Title: "Plan the week", Status: domain.StatusActive, Priority: p("normal"), Due: d(0)},
		{Title: "Book dentist appointment", Status: domain.StatusOpen, Priority: p("low"), Due: d(3), Tags: []string{"errand"}},
		{Title: "Read one chapter", Status: domain.StatusOpen, Due: d(1), Tags: []string{"habit"}},
		{Title: "Pay bills", Status: domain.StatusOpen, Priority: p("high"), Due: d(5), Tags: []string{"home"}},
	}},
	"onboarding": {Name: "Employee onboarding", Tasks: []templateTask{
		{Title: "Prepare laptop and accounts", Status: domain.StatusActive, Priority: p("high"), Due: d(0), Tags: []string{"IT"}},
		{Title: "Welcome meeting with the team", Status: domain.StatusOpen, Priority: p("normal"), Due: d(1), Tags: []string{"people"}},
		{Title: "First-week buddy check-ins", Status: domain.StatusOpen, Priority: p("normal"), Due: d(5), Tags: []string{"people"}, Subtasks: []string{"Day 1", "Day 3", "Day 5"}},
		{Title: "30-day goals", Status: domain.StatusOpen, Priority: p("normal"), Due: d(7), Tags: []string{"goals"}},
		{Title: "Onboarding feedback survey", Status: domain.StatusOpen, Priority: p("low"), Due: d(30), Tags: []string{"feedback"}},
	}},
}
