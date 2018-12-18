import hudson.tasks.test.AbstractTestResultAction
import hudson.tasks.junit.CaseResult

properties(
    [
        disableConcurrentBuilds(),
        buildDiscarder(
            logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '10')
        ),
        parameters (
            [
                string(defaultValue: "#smart-contracts", description: 'Slack channel', name: 'slackChannel')
                // @TODO: use ganache or not
                // @TODO: private key to use on public network
            ]
        ),
        pipelineTriggers(
            [pollSCM('*/1 * * * *')]
        )
    ]
)

def buildSucceeded = true
def failed = 0
def npmPublishFailed = false

@NonCPS
def getTestSummary = { ->
    def testResultAction = currentBuild.rawBuild.getAction(AbstractTestResultAction.class)
    def summary = ""

    if (testResultAction != null) {
        total = testResultAction.getTotalCount()
        failed = testResultAction.getFailCount()
        skipped = testResultAction.getSkipCount()

        summary = "Passed: " + (total - failed - skipped)
        summary = summary + (", Failed: " + failed)
        summary = summary + (", Skipped: " + skipped)
    } else {
        summary = "No tests found"
    }
    return summary
}

@NonCPS
def getFailedTests = { ->
    def testResultAction = currentBuild.rawBuild.getAction(AbstractTestResultAction.class)
    def failedTestsString = "```"

    if (testResultAction != null) {
        def failedTests = testResultAction.getFailedTests()

        if (failedTests.size() > 9) {
            failedTests = failedTests.subList(0, 8)
        }

        for(CaseResult cr : failedTests) {
            failedTestsString = failedTestsString + "${cr.getDisplayName()}:\n${cr.getErrorStackTrace()}\n\n"
        }
        failedTestsString = failedTestsString + "```"
    }
    return failedTestsString.replaceAll("\\n", "\\\\n")
}

def slack = {
    def buildStatus = buildSucceeded ? "succeeded" : "failed"
    def buildColor = buildSucceeded ? "good" : "bad"
    def commit = sh(returnStdout: true, script: 'git rev-parse HEAD')
    def author = sh(returnStdout: true, script: "git --no-pager show -s --format='%an' ${commit}").trim()
    def lastCommitMessage = sh(returnStdout: true, script: 'git log -1 --pretty=%B').trim().replaceAll("\\n", "\\\\n")
    def branch = sh(returnStdout: true, script: 'git log -n 1 --pretty=%D HEAD').trim().split(' ')[1]
    def testSummary = getTestSummary()

    def failedMessage = ""

    if (failed > 0) {
        failedTests = getFailedTests()
        failedMessage = """
            {
                title: "Failed tests",
                color: "${buildColor}",
                text: "${failedTests}",
                "mrkdwn_in": ["text"],
            },
        """
    }

    slackSend(
        message: "Message from Jenkins",
        channel: "${params.slackChannel}",
        attachments: """[
            {
                title: "${env.JOB_NAME}, build #${env.BUILD_NUMBER}",
                author_name: "${author}",
                text: "Build ${buildStatus}",
                color: "${buildColor}",
                title_link: "${env.BUILD_URL}",
                "mrkdwn_in": ["fields"],
                fields: [
                    {
                        title: "Branch",
                        value: "${branch}",
                        short: true
                    },
                    {
                        title: "Test results",
                        value: "${testSummary}",
                        short: true
                    },
                    {
                        title: "Last commit",
                        value: "${lastCommitMessage}",
                        short: true
                    },
                ]
            },
            ${failedMessage}
        ]"""
    )
}

node {
    docker.image('node:8-stretch').inside {
        def buildNumber = env.BUILD_NUMBER
        def workspace = env.WORKSPACE
        def buildUrl = env.BUILD_URL

        // PRINT ENVIRONMENT TO JOB
        echo "workspace directory is $workspace"
        echo "build URL is $buildUrl"
        echo "build Number is $buildNumber"

        nodejs(configId: '661cf31b-bdac-4946-bf6d-251593378980', nodeJSInstallationName: 'Node 8.x') {
            sh 'node --version'
            sh 'npm --version'

            try {
                stage('Checkout') {
                    checkout scm
                }

                stage('Build') {
                   echo 'Installing..'
                   sh "npm install"
                   echo 'Compiling..'
                   sh "npm run compile"
                }

                stage('Test') {
                    try {
                        sh "npm run test:ci"
                    } catch (e) {
                        junit 'reports/junitresults.xml'
                        throw e
                    }
                }

                stage('Report Junit results') {
                    step([$class: 'JUnitResultArchiver', testResults: 'reports/junitresults.xml'])
                }

                // @TODO: generate ABI for contracts
                // @TODO: flattening contracts

                archiveArtifacts artifacts: '**/build/contracts/*.json', fingerprint: true

                stage('Migrate') {
                    try {
                        echo 'Migrating..'
                        sh "npm run migrate"
                    } catch (e) {
                        npmPublishFailed = true
                    }
                }

                buildSucceeded = true

            } catch (e) {
                buildSucceeded = false
                throw e
            } finally {
                slack()
            }
        }
    }
}

