package di

import (
	"context"

	auditapp "github.com/indalyadav56/meetspace/backend/internal/audit/application"
	auditpg "github.com/indalyadav56/meetspace/backend/internal/audit/infrastructure/postgres"

	notifyapp "github.com/indalyadav56/meetspace/backend/internal/notify/application"
	notifypg "github.com/indalyadav56/meetspace/backend/internal/notify/infrastructure/postgres"
	realtimeapp "github.com/indalyadav56/meetspace/backend/internal/realtime/application"
	realtimedomain "github.com/indalyadav56/meetspace/backend/internal/realtime/domain"
	realtimeredis "github.com/indalyadav56/meetspace/backend/internal/realtime/infrastructure/redis"
	searchapp "github.com/indalyadav56/meetspace/backend/internal/search/application"
)

// WorkerContainer wires the background worker: scheduled work (reminders) and
// keeping the search index in step with every change published on the bus.
type WorkerContainer struct {
	*Shared
	Notify   *notifyapp.Service
	Search   *searchapp.Service
	Audit    *auditapp.Service
	Delivery *notifyapp.Delivery
	Bus      realtimedomain.Bus
}

func NewWorkerContainer(ctx context.Context, sh *Shared) (*WorkerContainer, error) {
	bus := realtimeredis.NewBus(sh.Redis)
	hub := realtimeapp.NewHub(bus, sh.Log)
	delivery, err := newDelivery(sh)
	if err != nil {
		return nil, err
	}
	return &WorkerContainer{
		Shared: sh, Notify: notifyapp.NewService(notifypg.NewRepository(sh.DB), hub), Search: newSearchService(ctx, sh),
		Audit: auditapp.NewService(auditpg.NewRepository(sh.DB), sh.Log), Delivery: delivery, Bus: bus,
	}, nil
}
