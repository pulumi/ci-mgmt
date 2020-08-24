#!/bin/bash
REPO=${MICROPLANE_REPO##*-}
rsync -azveP actions/providers/${REPO}/repo/ .

