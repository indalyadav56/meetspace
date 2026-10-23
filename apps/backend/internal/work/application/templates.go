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
}
