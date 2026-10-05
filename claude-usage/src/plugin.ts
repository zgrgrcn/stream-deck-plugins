import streamDeck from "@elgato/streamdeck";

import { UsageLimit } from "./actions/limit";

streamDeck.actions.registerAction(new UsageLimit());
streamDeck.connect();
