import streamDeck from "@elgato/streamdeck";

import { SystemMetric } from "./actions/metric";

streamDeck.actions.registerAction(new SystemMetric());
streamDeck.connect();
