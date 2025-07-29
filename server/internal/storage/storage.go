package storage

import (
	"bytes"
	"context"
	"drawer-service-backend/internal/config"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3Config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type StorageService struct {
	client     *s3.Client
	bucketName string
	region     string
}

func NewStorageService(cfg *config.Config) *StorageService {
	ctx := context.Background()

	// Create custom credentials provider
	credentials := aws.CredentialsProviderFunc(func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     cfg.AwsAccessKey,
			SecretAccessKey: cfg.AwsSecretKey,
		}, nil
	})

	// Load AWS config with custom credentials
	s3cfg, err := s3Config.LoadDefaultConfig(ctx,
		s3Config.WithRegion(cfg.S3BucketRegion),
		s3Config.WithCredentialsProvider(credentials),
	)

	if err != nil {
		log.Printf("Unable to load AWS SDK config: %v", err)
		return nil
	}

	s3Client := s3.NewFromConfig(s3cfg)

	return &StorageService{
		client:     s3Client,
		bucketName: cfg.S3BucketName,
		region:     cfg.S3BucketRegion,
	}
}

func (s *StorageService) UploadSubmission(userId string, submissionId string, imageData []byte) (string, error) {
	filename := getSubmissionImageFilename(userId, submissionId)
	return s.uploadImage(filename, imageData)
}

func (s *StorageService) UploadProfilePicture(userId string, imageData []byte) (string, error) {
	filename := getProfileImageFilename(userId)
	return s.uploadImage(filename, imageData)
}

func (s *StorageService) uploadImage(filename string, imageData []byte) (string, error) {
	_, err := s.client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(filename),
		Body:        bytes.NewReader(imageData),
		ContentType: aws.String("image/png"),
	})

	if err != nil {
		log.Printf("Failed to upload image to s3: %v", err)
		return "", err
	}

	return s.getUploadURL(filename), nil
}

func (s *StorageService) getUploadURL(imageName string) string {
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucketName, s.region, imageName)
}

func getSubmissionImageFilename(userId string, submissionId string) string {
	return fmt.Sprintf("%s/%s.png", userId, submissionId)
}

func getProfileImageFilename(userId string) string {
	return fmt.Sprintf("%s/profile-pic.png", userId)
}
