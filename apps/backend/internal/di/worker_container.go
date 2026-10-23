package di

import (
	notifyapp "github.com/indalyadav56/meetspace/backend/internal/notify/application"
	notifypg "github.com/indalyadav56/meetspace/backend/internal/notify/infrastructure/postgres"
	realtimeapp "github.com/indalyadav56/meetspace/backend/internal/realtime/application"
	realtimeredis "github.com/indalyadav56/meetspace/backend/internal/realtime/infrastructure/redis"
)

// WorkerContainer wires the background worker: it only needs what fires
// scheduled work (reminders) and publishes the results to clients.
type WorkerContainer struct {
	*Shared
	Notify *notifyapp.Service
}

func NewWorkerContainer(sh *Shared) *WorkerContainer {
	hub := realtimeapp.NewHub(realtimeredis.NewBus(sh.Redis), sh.Log)
	return &WorkerContainer{Shared: sh, Notify: notifyapp.NewService(notifypg.NewRepository(sh.DB), hub)}
}
