# -- Input -- #
INPUT="${1}"
OUTPUT="${2}"

# -- Constants -- #
REGION="eu-west-1"
CF_STACK_NAME="AhmtMeCdkStack"
BUCKET_NAME_CF_KEY="CDNBucketName"

# -- Read Cloudformation -- #
STACK_OUTPUT_MAP=$(aws cloudformation describe-stacks --stack-name ${CF_STACK_NAME} --region ${REGION} \
        --query 'Stacks[0].Outputs[*].{key:OutputKey,val:OutputValue}' | jq 'map( {(.key): .val} ) | add')

BUCKET_NAME=$(echo ${STACK_OUTPUT_MAP} | jq -r .${BUCKET_NAME_CF_KEY})

# -- Upload to S3-- #
S3_URL="s3://${BUCKET_NAME}"

aws s3 cp "${INPUT}" "${S3_URL}/${OUTPUT}"
