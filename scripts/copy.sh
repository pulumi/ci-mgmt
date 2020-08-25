#!/bin/bash
REPO=${MICROPLANE_REPO##*-}

CI_MGMT_DIR="${1}"

if [ -z "${CI_MGMT_DIR}" ];
then
    echo "please specify path to ci dir"
    exit 1
fi

rsync -azveP ${CI_MGMT_DIR}/actions/providers/${REPO}/repo/ .

